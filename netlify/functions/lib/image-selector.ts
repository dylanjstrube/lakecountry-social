import { readFileSync } from "fs";
import { join } from "path";
import { getImageLastUsed, setImageLastUsed } from "./blobs.js";
import type { ManifestImage, ImageManifest, DailyContext, Season } from "./types.js";

let _manifest: ImageManifest | null = null;

function loadManifest(): ImageManifest {
  if (_manifest) return _manifest;
  const manifestPath = join(process.cwd(), "images", "manifest.json");
  const raw = readFileSync(manifestPath, "utf-8");
  _manifest = JSON.parse(raw) as ImageManifest;
  return _manifest;
}

function imageMatchesSeason(image: ManifestImage, season: Season): boolean {
  return image.season.includes("all") || image.season.includes(season);
}

async function scoreImage(image: ManifestImage, today: string): Promise<number> {
  const lastUsed = await getImageLastUsed(image.path);
  if (!lastUsed) return 100; // never used — highest priority
  const daysSince = Math.floor(
    (new Date(today).getTime() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.min(daysSince, 100);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface SelectedImages {
  images: ManifestImage[];
  // Map from pairId → [before, after] for before/after pairs included
  pairs: Map<string, [ManifestImage, ManifestImage]>;
}

export async function selectImages(
  context: DailyContext,
  count: number = 10
): Promise<ManifestImage[]> {
  const manifest = loadManifest();
  const { season, productSpotlight, date } = context;

  // Separate images by type
  const productImages = manifest.images.filter(
    (img) =>
      img.type === "product" &&
      imageMatchesSeason(img, season) &&
      img.productLine === productSpotlight
  );

  const otherProductImages = manifest.images.filter(
    (img) =>
      img.type === "product" &&
      imageMatchesSeason(img, season) &&
      img.productLine !== productSpotlight
  );

  const lifestyleImages = manifest.images.filter(
    (img) => img.type === "lifestyle" && imageMatchesSeason(img, season)
  );

  // Get before/after pairs — always include both members of a pair together
  const allBeforeImages = manifest.images.filter(
    (img) => img.type === "before-after" && img.beforeAfterRole === "before"
  );
  const afterByPairId = new Map(
    manifest.images
      .filter((img) => img.type === "before-after" && img.beforeAfterRole === "after")
      .map((img) => [img.beforeAfterPairId, img])
  );

  // Score all images for freshness
  const scoreImg = async (img: ManifestImage) => ({
    img,
    score: await scoreImage(img, date),
  });

  const [
    scoredProduct,
    scoredOtherProduct,
    scoredLifestyle,
    scoredBefore,
  ] = await Promise.all([
    Promise.all(productImages.map(scoreImg)),
    Promise.all(otherProductImages.map(scoreImg)),
    Promise.all(lifestyleImages.map(scoreImg)),
    Promise.all(allBeforeImages.map(scoreImg)),
  ]);

  const sortByScore = (a: { score: number }, b: { score: number }) => b.score - a.score;

  scoredProduct.sort(sortByScore);
  scoredOtherProduct.sort(sortByScore);
  scoredLifestyle.sort(sortByScore);
  scoredBefore.sort(sortByScore);

  const selected: ManifestImage[] = [];

  // Target mix: 3 spotlight product, 2 other product, 2 lifestyle, 1 before/after pair (= 2 slots)
  // Remaining 1 slot filled from whatever is available

  // 1 before/after pair (if any exist)
  let pairsAdded = 0;
  for (const { img: before } of scoredBefore) {
    const after = afterByPairId.get(before.beforeAfterPairId);
    if (after && selected.length + 2 <= count) {
      selected.push(before, after);
      pairsAdded++;
      break; // only 1 pair per batch
    }
  }

  // Fill remaining slots
  const slotsLeft = count - selected.length;
  const productTarget = Math.ceil(slotsLeft * 0.4);
  const otherProductTarget = Math.ceil(slotsLeft * 0.25);
  const lifestyleTarget = slotsLeft - productTarget - otherProductTarget;

  const addFromPool = (pool: { img: ManifestImage }[], limit: number) => {
    let added = 0;
    for (const { img } of pool) {
      if (added >= limit || selected.length >= count) break;
      if (!selected.includes(img)) {
        selected.push(img);
        added++;
      }
    }
  };

  addFromPool(scoredProduct, productTarget);
  addFromPool(scoredOtherProduct, otherProductTarget);
  addFromPool(scoredLifestyle, lifestyleTarget);

  // Top up if still short
  const allScored = shuffle([...scoredProduct, ...scoredOtherProduct, ...scoredLifestyle]);
  addFromPool(allScored, count - selected.length);

  // Mark all selected images as used today
  await Promise.all(selected.map((img) => setImageLastUsed(img.path, date)));

  return selected;
}
