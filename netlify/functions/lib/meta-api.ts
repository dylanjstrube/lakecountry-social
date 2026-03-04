const GRAPH_API_VERSION = "v21.0";
const BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

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
 * Returns the Facebook post ID.
 */
export async function postToFacebook(imageUrl: string, caption: string): Promise<string> {
  const pageId = getPageId();
  const data = await graphPost(`${pageId}/photos`, {
    url: imageUrl,
    caption,
  });
  return data.id;
}

/**
 * Post an image + caption to the Instagram Business Account.
 * Instagram requires a 2-step flow: create container → publish.
 * Returns the Instagram media ID.
 */
export async function postToInstagram(imageUrl: string, caption: string): Promise<string> {
  const igUserId = getIgUserId();

  // Step 1: Create media container
  const container = await graphPost(`${igUserId}/media`, {
    image_url: imageUrl,
    caption,
  });

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
