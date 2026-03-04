import type { Handler } from "@netlify/functions";
import { getDrafts, savePublished, saveComposedImage } from "./lib/blobs.js";
import { postToFacebook, postToInstagram } from "./lib/meta-api.js";
import type { PublishedPost } from "./lib/types.js";

/**
 * POST /.netlify/functions/publish-post
 * Body (JSON): { draftId: string, imageBase64: string }
 *
 * 1. Validates the draft exists and hasn't been published
 * 2. Uploads the composed image to Netlify Blobs (public URL)
 * 3. Posts to Instagram (2-step container flow)
 * 4. Posts to Facebook
 * 5. Saves the published record to Blobs
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body: { draftId?: string; imageBase64?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { draftId, imageBase64 } = body;

  if (!draftId || !imageBase64) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields: draftId, imageBase64" }),
    };
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

  // Load drafts and find the target draft
  const drafts = await getDrafts(today);
  if (!drafts) {
    return { statusCode: 404, body: JSON.stringify({ error: "No drafts for today" }) };
  }

  const draft = drafts.find((d) => d.id === draftId);
  if (!draft) {
    return { statusCode: 404, body: JSON.stringify({ error: "Draft not found" }) };
  }

  // Convert base64 to buffer (strip data URL prefix if present)
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer = Buffer.from(base64Data, "base64");

  // Upload composed image to Netlify Blobs and get public URL
  let imageUrl: string;
  try {
    imageUrl = await saveComposedImage(today, draftId, imageBuffer);
  } catch (err) {
    console.error("Failed to upload composed image:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to upload image" }),
    };
  }

  // Combine caption + hashtags
  const fullCaption = draft.caption;

  // Post to Instagram and Facebook in parallel where possible
  // (Instagram requires 2-step, Facebook is 1-step — run concurrently)
  let instagramMediaId: string;
  let facebookPostId: string;

  try {
    [instagramMediaId, facebookPostId] = await Promise.all([
      postToInstagram(imageUrl, fullCaption),
      postToFacebook(imageUrl, fullCaption),
    ]);
  } catch (err) {
    console.error("Meta API posting failed:", err);
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: "Failed to post to one or more platforms",
        detail: err instanceof Error ? err.message : String(err),
      }),
    };
  }

  const publishedPost: PublishedPost = {
    draftId,
    date: today,
    publishedAt: new Date().toISOString(),
    facebookPostId,
    instagramMediaId,
    caption: fullCaption,
    imagePath: draft.imagePath,
  };

  await savePublished(publishedPost);

  console.log(`Published post ${draftId} — FB: ${facebookPostId}, IG: ${instagramMediaId}`);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      success: true,
      facebookPostId,
      instagramMediaId,
    }),
  };
};
