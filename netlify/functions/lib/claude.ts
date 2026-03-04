import Anthropic from "@anthropic-ai/sdk";
import type { DailyContext, ManifestImage, ClaudeCaption, CtaType } from "./types.js";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a social media copywriter for Lake Country Decking, a Trex composite deck resurfacing company based in Delafield, Wisconsin. You write authentic, friendly, neighborhood-expert posts for Facebook and Instagram.

Tone: warm, knowledgeable, community-oriented. Never salesy or corporate. Speak like a neighbor who happens to be a deck expert.

Primary CTA: always direct people to www.lakecountrydecking.com (unless instructed to use phone).
Phone CTA (when specified): (920) 355-2174
Service area: Delafield, Pewaukee, Oconomowoc, Hartland, Waukesha, Southeastern Wisconsin.

The company resurfaces old wood decks with Trex composite boards — homeowners keep their existing frame but get beautiful new composite boards and railings. No full rebuild required.`;

const PRODUCT_INFO: Record<string, { warranty: string; priceRange: string; description: string }> = {
  enhance: {
    warranty: "25-year",
    priceRange: "$8–$12/sq ft",
    description: "Trex Enhance® — great value, 10 beautiful colors",
  },
  select: {
    warranty: "35-year",
    priceRange: "$12–$17/sq ft",
    description: "Trex Select® — enhanced durability, 5 classic colors",
  },
  transcend: {
    warranty: "50-year",
    priceRange: "$17–$28/sq ft",
    description: "Trex Transcend® — premium line, 50-year warranty, 6 rich colors",
  },
};

function buildUserPrompt(
  image: ManifestImage,
  context: DailyContext,
  ctaType: CtaType,
  toneVariant: string
): string {
  const cta =
    ctaType === "website"
      ? "End with a CTA directing people to www.lakecountrydecking.com"
      : "End with a CTA to call (920) 355-2174 for a free quote";

  if (image.type === "before-after") {
    const role = image.beforeAfterRole === "before" ? "BEFORE" : "AFTER";
    const productDesc = image.productLine
      ? PRODUCT_INFO[image.productLine]?.description ?? ""
      : "Trex composite";
    const colorNote = image.colorName ? ` in ${image.colorName}` : "";

    return `Image type: BEFORE/AFTER TRANSFORMATION — this is the ${role} photo.
Product shown (after): ${productDesc}${colorNote}
Season: ${context.season} in Wisconsin
${context.upcomingHoliday ? `Upcoming: ${context.upcomingHoliday}` : ""}
Tone variant: ${toneVariant}

Generate copy ${role === "BEFORE" ? "emphasizing the problem — the pain of maintaining an old, splintering, faded wood deck" : "celebrating the transformation — the relief and joy of a beautiful, maintenance-free Trex deck"}. Focus on emotion over specs.
${cta}.

Return ONLY valid JSON, no markdown, no commentary:
{
  "headlineText": "<punchy, ≤8 words, no hashtags>",
  "caption": "<2-4 sentences>",
  "hashtags": ["#LakeCountryDecking", "#TrexDecking", "#WisconsinDeck", "...3-5 more relevant tags"],
  "ctaText": "<your CTA line>"
}`;
  }

  // Product or lifestyle image
  const product = image.productLine ? PRODUCT_INFO[image.productLine] : null;
  const productLine = product ? `Trex ${image.productLine} (${product.warranty} warranty, ${product.priceRange})` : "Trex composite";
  const colorNote = image.colorName ? ` · Color: ${image.colorName}` : "";

  return `Image: ${productLine}${colorNote}
Season: ${context.season} in Wisconsin
Seasonal note: ${context.weatherNote}
${context.upcomingHoliday ? `Upcoming: ${context.upcomingHoliday}` : ""}
${context.promotionNote ? `Promotion: ${context.promotionNote}` : ""}
Tone variant: ${toneVariant}

${image.colorName ? `Mention the color "${image.colorName}" naturally in the caption.` : ""}
Reference the Wisconsin season or local context at least once.
${cta}.

Return ONLY valid JSON, no markdown, no commentary:
{
  "headlineText": "<punchy, ≤8 words, no hashtags>",
  "caption": "<2-4 sentences>",
  "hashtags": ["#LakeCountryDecking", "#TrexDecking", "#WisconsinDeck", "...3-5 more relevant tags"],
  "ctaText": "<your CTA line>"
}`;
}

const TONE_VARIANTS = [
  "warm and neighborly",
  "inspiring and aspirational",
  "practical and educational",
  "celebratory — focus on summer/outdoor living",
  "empathetic — understand the homeowner's frustration with maintenance",
  "confident expert — highlight Trex quality and longevity",
  "local pride — emphasize Wisconsin community",
  "seasonal urgency — book before the season fills up",
  "before/after transformation narrative",
  "light and conversational",
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateCaption(
  image: ManifestImage,
  context: DailyContext,
  ctaType: CtaType,
  index: number
): Promise<ClaudeCaption> {
  const toneVariant = TONE_VARIANTS[index % TONE_VARIANTS.length];
  const userPrompt = buildUserPrompt(image, context, ctaType, toneVariant);

  // Stagger calls to avoid rate limits
  if (index > 0) await delay(600);

  const attempt = async (): Promise<ClaudeCaption> => {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

    // Strip markdown fences if Claude adds them despite instruction
    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    return JSON.parse(clean) as ClaudeCaption;
  };

  try {
    return await attempt();
  } catch {
    // One retry
    await delay(1000);
    return await attempt();
  }
}
