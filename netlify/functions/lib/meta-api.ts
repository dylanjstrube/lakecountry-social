const GRAPH_API_VERSION = "v21.0";
const BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const WEBSITE_URL = "https://www.lakecountrydecking.com";

// Facebook Place ID for Delafield, WI.
// To find yours: GET /search?type=place&q=Delafield+WI&fields=name,id via Graph API Explorer.
// Set META_DELAFIELD_PLACE_ID in Netlify environment variables once confirmed.
const DELAFIELD_PLACE_ID = process.env.META_DELAFIELD_PLACE_ID ?? "";

function getToken(): string {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN is not set");
  return token;
}

function getPageId(): string {
  const id = process.env.META_PAGE_ID;
  if (!id) throw new Error("META_PAGE_ID is not set");
  return id;
}

function getIgUserId(): string {
  const id = process.env.META_IG_USER_ID;
  if (!id) throw new Error("META_IG_USER_ID is not set");
  return id;
}

async function graphPost(
  path: string,
  params: Record<string, string>
): Promise<Record<string, string>> {
  const token = getToken();
  const body = new URLSearchParams({ ...params, access_token: token });

  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    body,
  });

  const data = (await res.json()) as Record<string, string>;

  if (!res.ok || data.error) {
    const errMsg = data.error
      ? JSON.stringify(data.error)
      : `HTTP ${res.status}`;
    throw new Error(`Meta Graph API error on /${path}: ${errMsg}`);
  }

  return data;
}

/**
 * Post an image + caption to the Facebook Page.
 * Includes a native "Get Quote" CTA button and associates the website URL.
 * Returns the Facebook post ID.
 */
export async function postToFacebook(imageUrl: string, caption: string): Promise<string> {
  const pageId = getPageId();

  const params: Record<string, string> = {
    url: imageUrl,
    caption,
    link: WEBSITE_URL,
    call_to_action: JSON.stringify({
      type: "GET_QUOTE",
      value: { link: WEBSITE_URL },
    }),
  };

  if (DELAFIELD_PLACE_ID) {
    params.place = DELAFIELD_PLACE_ID;
  }

  const data = await graphPost(`${pageId}/photos`, params);
  return data.id;
}

/**
 * Post an image + caption to the Instagram Business Account.
 * Instagram requires a 2-step flow: create container → publish.
 * Adds location tagging when META_DELAFIELD_PLACE_ID is set.
 * Returns the Instagram media ID.
 */
export async function postToInstagram(imageUrl: string, caption: string): Promise<string> {
  const igUserId = getIgUserId();

  const containerParams: Record<string, string> = {
    image_url: imageUrl,
    caption,
  };

  if (DELAFIELD_PLACE_ID) {
    containerParams.location_id = DELAFIELD_PLACE_ID;
  }

  // Step 1: Create media container
  const container = await graphPost(`${igUserId}/media`, containerParams);

  if (!container.id) {
    throw new Error("Instagram media container creation failed — no ID returned");
  }

  // Brief pause before publishing (Meta recommends waiting for container processing)
  await new Promise((r) => setTimeout(r, 3000));

  // Step 2: Publish the container
  const publish = await graphPost(`${igUserId}/media_publish`, {
    creation_id: container.id,
  });

  return publish.id;
}
