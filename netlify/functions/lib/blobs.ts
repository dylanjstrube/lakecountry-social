import { getStore } from "@netlify/blobs";
import type { DraftPost, PublishedPost } from "./types.js";

const DRAFTS_STORE = "social-drafts";
const IMAGES_STORE = "social-images";

export async function getDrafts(date: string): Promise<DraftPost[] | null> {
  const store = getStore(DRAFTS_STORE);
  const raw = await store.get(`drafts/${date}`, { type: "json" });
  return raw as DraftPost[] | null;
}

export async function saveDrafts(date: string, drafts: DraftPost[]): Promise<void> {
  const store = getStore(DRAFTS_STORE);
  await store.setJSON(`drafts/${date}`, drafts);
}

export async function getPublished(date: string): Promise<PublishedPost | null> {
  const store = getStore(DRAFTS_STORE);
  const raw = await store.get(`published/${date}`, { type: "json" });
  return raw as PublishedPost | null;
}

export async function savePublished(post: PublishedPost): Promise<void> {
  const store = getStore(DRAFTS_STORE);
  await store.setJSON(`published/${post.date}`, post);
}

export async function getLastRunDate(): Promise<string | null> {
  const store = getStore(DRAFTS_STORE);
  const raw = await store.get("meta/last-run", { type: "text" });
  return raw as string | null;
}

export async function setLastRunDate(date: string): Promise<void> {
  const store = getStore(DRAFTS_STORE);
  await store.set("meta/last-run", date);
}

export async function getImageLastUsed(imagePath: string): Promise<string | null> {
  const store = getStore(DRAFTS_STORE);
  const key = `image-usage/${imagePath.replace(/\//g, "_")}`;
  const raw = await store.get(key, { type: "text" });
  return raw as string | null;
}

export async function setImageLastUsed(imagePath: string, date: string): Promise<void> {
  const store = getStore(DRAFTS_STORE);
  const key = `image-usage/${imagePath.replace(/\//g, "_")}`;
  await store.set(key, date);
}

export async function saveComposedImage(
  date: string,
  draftId: string,
  imageBuffer: Buffer
): Promise<string> {
  const store = getStore({ name: IMAGES_STORE, consistency: "strong" });
  const key = `${date}/${draftId}.jpg`;
  // Netlify Blobs accepts ArrayBufferView; Buffer is a Uint8Array (ArrayBufferView)
  await store.set(key, imageBuffer as unknown as ArrayBuffer, {
    metadata: { contentType: "image/jpeg" },
  });
  // Return the public URL — format for Netlify Blobs
  const siteUrl = process.env.URL ?? "http://localhost:8888";
  return `${siteUrl}/.netlify/blobs/${IMAGES_STORE}/${key}`;
}
