/**
 * Background function — runs up to 15 minutes.
 * Orchestrates the full draft generation pipeline:
 * 1. Check if we ran recently (skip if so)
 * 2. Build daily context (season, holidays, product rotation)
 * 3. Select 10 images from the library
 * 4. Generate Claude captions for each image
 * 5. Assemble DraftPost objects and save to Netlify Blobs
 * 6. Send email notification via Netlify Forms
 */
import { randomUUID } from "crypto";
import type { Handler } from "@netlify/functions";
import { buildDailyContext } from "./lib/context.js";
import { selectImages } from "./lib/image-selector.js";
import { generateCaption } from "./lib/claude.js";
import {
  getDrafts,
  saveDrafts,
  getLastRunDate,
  setLastRunDate,
} from "./lib/blobs.js";
import type { DraftPost, CtaType, ManifestImage, DailyContext, OverlayConfig } from "./lib/types.js";

function estimateFontSize(text: string, max: number, min: number): number {
  const chars = text.length;
  if (chars <= 20) return max;
  if (chars <= 35) return Math.round(max * 0.85);
  return min;
}

function buildOverlayConfig(
  headlineText: string,
  bodyText: string
): OverlayConfig {
  return {
    headlineText,
    headlineFontSize: estimateFontSize(headlineText, 72, 48),
    bodyText,
    bodyFontSize: estimateFontSize(bodyText, 32, 24),
  };
}

function assignCtaTypes(count: number): CtaType[] {
  // 8 website, 2 phone — shuffle for variety
  const types: CtaType[] = [
    ...Array(Math.max(0, count - 2)).fill("website"),
    "phone",
    "phone",
  ].slice(0, count) as CtaType[];

  // Fisher-Yates shuffle
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

async function sendNotification(date: string): Promise<void> {
  const siteUrl = process.env.URL;
  if (!siteUrl) return;

  try {
    await fetch(siteUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        "form-name": "post-notification",
        message: `Your 10 social media post options for ${date} are ready to review and publish.`,
        "portal-url": `${siteUrl}/`,
      }).toString(),
    });
    console.log("Notification sent via Netlify Forms");
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
}

export const handler: Handler = async () => {
  // Background functions return 202 immediately — the work continues after
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

  // Async work runs after response is sent
  void runGeneration(today);

  return {
    statusCode: 202,
    body: JSON.stringify({ message: "Generation started", date: today }),
  };
};

async function runGeneration(today: string): Promise<void> {
  try {
    // Belt-and-suspenders: skip if already ran in the last 2 days
    const lastRun = await getLastRunDate();
    if (lastRun) {
      const daysSince = Math.floor(
        (new Date(today).getTime() - new Date(lastRun).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysSince < 2) {
        console.log(`Already ran ${daysSince} day(s) ago (${lastRun}), skipping`);
        return;
      }
    }

    // Skip if drafts already exist for today
    const existing = await getDrafts(today);
    if (existing && existing.length > 0) {
      console.log(`Drafts already exist for ${today}, skipping`);
      return;
    }

    console.log(`Starting draft generation for ${today}`);

    const context = buildDailyContext(new Date());
    console.log(`Context: season=${context.season}, spotlight=${context.productSpotlight}`);

    const images = await selectImages(context, 10);
    console.log(`Selected ${images.length} images`);

    const ctaTypes = assignCtaTypes(images.length);

    const drafts: DraftPost[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const ctaType = ctaTypes[i];

      console.log(`Generating caption ${i + 1}/${images.length} for ${image.path}`);

      const caption = await generateCaption(image, context, ctaType, i);

      const draft: DraftPost = {
        id: randomUUID(),
        date: today,
        index: i,
        imagePath: image.path,
        imageSource: image.source,
        imageType: image.type,
        beforeAfterRole: image.beforeAfterRole,
        beforeAfterPairId: image.beforeAfterPairId,
        colorName: image.colorName,
        productLine: image.productLine,
        overlayConfig: buildOverlayConfig(caption.headlineText, caption.caption),
        caption: `${caption.caption}\n\n${caption.hashtags.join(" ")}`,
        hashtags: caption.hashtags,
        ctaType,
        context,
      };

      drafts.push(draft);
    }

    await saveDrafts(today, drafts);
    await setLastRunDate(today);
    console.log(`Saved ${drafts.length} drafts for ${today}`);

    await sendNotification(today);
  } catch (err) {
    console.error("Draft generation failed:", err);
  }
}
