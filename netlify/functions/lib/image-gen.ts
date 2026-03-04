/**
 * AI image generation using Flux 2 (via fal.ai) or Stability AI.
 * Used to replenish the image library when the local pool runs low.
 *
 * Phase 1: Flux 2 via fal.ai REST API
 * Phase 2: Runway Gen-4 Turbo for video/reels (not yet implemented)
 */

const FLUX_API_URL = "https://fal.run/fal-ai/flux/dev";

interface FluxResponse {
  images: { url: string; content_type: string }[];
}

const DECK_PROMPTS = {
  before: [
    "weathered gray wood deck boards, peeling paint, split planks, faded color, residential backyard, Wisconsin suburban home, late afternoon light, realistic photo",
    "old pressure-treated wood deck, cracked and splintering boards, rusty nails, worn railings, overgrown yard visible, natural daylight, realistic photography",
    "deteriorating wooden deck with stain peeling off, sun-bleached boards, aged appearance, suburban backyard patio, photorealistic",
  ],
  after: [
    "beautiful new Trex composite deck, rich brown color, clean modern railings, lush green lawn background, Wisconsin suburban home, golden hour light, photorealistic",
    "elegant composite deck boards in warm gray tone, pristine white railings, outdoor furniture, lake country Wisconsin backyard, sunny day, ultra realistic photo",
    "stunning composite deck resurfacing, dark espresso color boards, glass panel railings, outdoor living space, well-maintained yard, professional real estate photography",
  ],
};

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function generateDeckImage(
  role: "before" | "after"
): Promise<{ url: string; prompt: string } | null> {
  const apiKey = process.env.FLUX_API_KEY;
  if (!apiKey) {
    console.warn("FLUX_API_KEY not set — skipping AI image generation");
    return null;
  }

  const prompt = randomFrom(DECK_PROMPTS[role]);

  try {
    const res = await fetch(FLUX_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: "square_hd", // 1024×1024
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    if (!res.ok) {
      console.error("Flux API error:", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as FluxResponse;
    return { url: data.images[0].url, prompt };
  } catch (err) {
    console.error("Flux generation failed:", err);
    return null;
  }
}

export async function downloadImageAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}
