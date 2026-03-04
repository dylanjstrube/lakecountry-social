/**
 * Standalone Claude prompt tester.
 * Run with: npm run test:prompt
 *
 * Tests a single caption generation against the first Enhance product image.
 * Useful for tuning prompts before deploying.
 */
import { buildDailyContext } from "../netlify/functions/lib/context.js";
import { generateCaption } from "../netlify/functions/lib/claude.js";
import type { ManifestImage } from "../netlify/functions/lib/types.js";

const testImage: ManifestImage = {
  path: "https://www.lakecountrydecking.com/assets/images/products/enhance/hero/foggy-wharf.jpg",
  source: "local",
  type: "product",
  productLine: "enhance",
  colorName: "Foggy Wharf",
  tags: ["grey", "coastal", "modern"],
  season: ["all"],
};

const testBeforeAfterImage: ManifestImage = {
  path: "images/before-after/deck-01-before.jpg",
  source: "local",
  type: "before-after",
  beforeAfterRole: "before",
  beforeAfterPairId: "deck-01",
  tags: ["weathered", "wood", "old"],
  season: ["all"],
};

async function main() {
  const context = buildDailyContext(new Date());
  console.log("\n── Daily Context ──────────────────────────────");
  console.log(JSON.stringify(context, null, 2));

  console.log("\n── Generating product image caption… ──────────");
  const caption1 = await generateCaption(testImage, context, "website", 0);
  console.log(JSON.stringify(caption1, null, 2));

  console.log("\n── Generating before/after caption… ───────────");
  const caption2 = await generateCaption(testBeforeAfterImage, context, "phone", 1);
  console.log(JSON.stringify(caption2, null, 2));

  console.log("\n✓ Done");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
