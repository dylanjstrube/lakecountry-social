/**
 * Image proxy — fetches product images from lakecountrydecking.com and
 * returns them with CORS headers so the portal canvas can draw them.
 *
 * GET /.netlify/functions/image-proxy?url=<encoded-image-url>
 */
import type { Handler } from "@netlify/functions";

const ALLOWED_ORIGIN = "https://www.lakecountrydecking.com";

export const handler: Handler = async (event) => {
  const url = event.queryStringParameters?.url;

  if (!url) {
    return { statusCode: 400, body: "Missing url parameter" };
  }

  // Only proxy images from the known domain
  if (!url.startsWith(ALLOWED_ORIGIN + "/")) {
    return { statusCode: 403, body: "URL not allowed" };
  }

  const response = await fetch(url);
  if (!response.ok) {
    return { statusCode: response.status, body: "Failed to fetch image" };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "image/jpeg";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
    },
    body: buffer.toString("base64"),
    isBase64Encoded: true,
  };
};
