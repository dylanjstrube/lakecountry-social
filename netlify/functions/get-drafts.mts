import type { Handler } from "@netlify/functions";
import { getDrafts, getPublished } from "./lib/blobs.js";

/**
 * GET /.netlify/functions/get-drafts?date=YYYY-MM-DD
 * Returns the 10 DraftPost objects for the given date (defaults to today).
 * Also returns whether a post has already been published for that date.
 */
export const handler: Handler = async (event) => {
  const date =
    (event.queryStringParameters?.date as string) ??
    new Date().toISOString().split("T")[0];

  // Basic date format validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." }),
    };
  }

  const [drafts, published] = await Promise.all([
    getDrafts(date),
    getPublished(date),
  ]);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  if (!drafts) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        error: "No drafts found for this date",
        date,
        published: null,
      }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      date,
      drafts,
      published: published ?? null,
    }),
  };
};
