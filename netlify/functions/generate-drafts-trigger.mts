import type { Config } from "@netlify/functions";

/**
 * Scheduled function — fires every 3 days at 7 AM CT.
 * Its only job is to trigger the background function (which can run up to 15 min).
 * Scheduled functions have a 30-second execution limit, so we hand off immediately.
 */
export default async (): Promise<Response> => {
  const siteUrl = process.env.URL;
  if (!siteUrl) {
    console.error("URL environment variable not set");
    return new Response("Missing URL env var", { status: 500 });
  }

  const backgroundUrl = `${siteUrl}/.netlify/functions/generate-drafts-background`;

  console.log(`Triggering background draft generation at ${backgroundUrl}`);

  // Fire-and-forget — background function returns 202 immediately
  fetch(backgroundUrl, { method: "POST" }).catch((err) => {
    console.error("Failed to trigger background function:", err);
  });

  return new Response("Triggered", { status: 200 });
};

export const config: Config = {
  schedule: "0 13 */3 * *", // Every 3 days at 7 AM CT (UTC-6)
};
