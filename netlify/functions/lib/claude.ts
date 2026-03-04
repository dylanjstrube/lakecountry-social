import Anthropic from "@anthropic-ai/sdk";
import type { DailyContext, ManifestImage, ClaudeCaption, CtaType } from "./types.js";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a social media copywriter for Lake Country Decking, a Trex composite deck resurfacing company based in Delafield, Wisconsin.

CORE MESSAGE: We help homeowners in Lake Country replace their old, worn, rotting, splintering wood decks with beautiful low-maintenance Trex composite boards — using the existing frame. No full rebuild. One crew, one project, total transformation.

HEADLINE RULES (this appears large on the image — make it count):
- ≤8 words. Punchy, direct, scroll-stopping.
- No brand taglines. No hashtags. No company name.
- Hook on PAIN (splinters, maintenance, embarrassment, missed summers) OR ASPIRATION (hosting friends, relaxing, pride, dream deck).
- Use seasonal context aggressively: spring → "before the summer rush", summer → "this summer", fall → "plan now for next spring", winter → "dream about next summer".
- Goal: make someone stop scrolling and think "that's me."

CAPTION RULES:
- 2–3 sentences. Conversational, warm, neighborhood-expert tone. Never corporate or salesy.
- Reference the Wisconsin season or local Lake Country context once.
- End with the CTA (website URL or phone, as specified).

DIVERSITY: You will write 10 posts per batch. Each post MUST have a completely different angle and emotional hook. No two headlines in a batch should share the same theme.`;

// Tone angles — each post in a 10-post batch uses a different angle
const TONE_VARIANTS = [
  "PAIN-POINT: Focus on the problem — splintering boards, annual sanding/staining, bare feet on rough wood, the embarrassment of hosting on a beat-up deck",
  "SEASONAL URGENCY: It's time to get your deck ready before the season fills up — book now while crews are available",
  "ASPIRATIONAL: Paint a picture of the dream deck — sunset cocktails, summer entertaining, the outdoor space you've always wanted",
  "NEIGHBORHOOD PRIDE: Best deck on the block — your neighbors will notice the transformation",
  "FINANCIAL/VALUE: Never spend another dollar on deck maintenance — Trex composite pays for itself. Mention the 25-50 year warranty.",
  "TIME LIBERATION: No more staining, sealing, or sanding — ever again. What would you do with those summer weekends instead?",
  "TRANSFORMATION NARRATIVE: The dramatic reveal — one week of work, a completely different home. Before vs. after.",
  "LOCAL COMMUNITY: Delafield and Lake Country homeowners trust Lake Country Decking for their resurface. Local crew, local expertise.",
  "ENTERTAINING/HOLIDAY: Tie to an upcoming holiday or outdoor gathering occasion — the deck needs to be ready before the party",
  "FOMO: Your neighbors across the lake already did it. Here's why everyone in Lake Country is resurfacing this season.",
];

function buildUserPrompt(
  image: ManifestImage,
  context: DailyContext,
  ctaType: CtaType,
  toneVariant: string
): string {
  const cta =
    ctaType === "website"
      ? "End with: Get a free quote at www.lakecountrydecking.com"
      : "End with: Call us for a free quote: (920) 355-2174";

  const seasonalGuide = {
    spring: "Spring has arrived in Wisconsin — homeowners are thinking about their decks for the first time since winter. Memorial Day and summer BBQ season are right around the corner.",
    summer: "It's summer in Lake Country — homeowners are using their decks daily. Some are enjoying them; others are embarrassed by their worn wood boards and making a change.",
    fall: "Fall in Wisconsin — the perfect time to plan a spring resurface and beat the rush. Homeowners who plan now get priority scheduling.",
    winter: "Wisconsin winter — homeowners are dreaming about next summer. Plant the seed now for a spring transformation.",
  }[context.season];

  const holidayNote = context.upcomingHoliday
    ? `Upcoming occasion: ${context.upcomingHoliday} — weave this in if it fits the tone.`
    : "";

  if (image.type === "before-after") {
    const role = image.beforeAfterRole === "before" ? "BEFORE" : "AFTER";
    return `Image: BEFORE/AFTER TRANSFORMATION — this is the ${role} photo.
Seasonal context: ${seasonalGuide}
${holidayNote}
Tone angle: ${toneVariant}

${role === "BEFORE"
  ? "Write copy that amplifies the pain — the old deck is worn, faded, splintering. This homeowner NEEDS a change. Drive urgency and empathy."
  : "Write copy that celebrates the transformation — relief, pride, joy. The deck looks incredible. This could be yours."}
${cta}.

Return ONLY valid JSON (no markdown, no commentary):
{
  "headlineText": "<punchy, ≤8 words, scroll-stopping>",
  "caption": "<2-3 sentences>",
  "hashtags": ["#LakeCountryDecking", "#DeckResurface", "#TrexComposite", "#WisconsinDeck", "#DelafiledWI", "#CompositeDecking", "#DeckTransformation", "#LowMaintenance"],
  "ctaText": "<your CTA line>"
}`;
  }

  return `Image: ${image.type === "lifestyle" ? "outdoor deck lifestyle photo" : "composite decking product photo"}
Seasonal context: ${seasonalGuide}
${holidayNote}
Tone angle: ${toneVariant}

Focus on resurfacing — transforming an old worn wood deck with new Trex composite boards. Make the headline stop-the-scroll worthy.
${cta}.

Return ONLY valid JSON (no markdown, no commentary):
{
  "headlineText": "<punchy, ≤8 words, scroll-stopping>",
  "caption": "<2-3 sentences>",
  "hashtags": ["#LakeCountryDecking", "#DeckResurface", "#TrexComposite", "#WisconsinDeck", "#DelafiledWI", "#CompositeDecking", "#DeckTransformation", "#LowMaintenance"],
  "ctaText": "<your CTA line>"
}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateCaption(
  image: ManifestImage,
  context: DailyContext,
  ctaType: CtaType,
  index: number
): Promise<ClaudeCaption> {
  const toneVariant = TONE_VARIANTS[index % TONE_VARIANTS.length];
  const userPrompt = buildUserPrompt(image, context, ctaType, toneVariant);

  // Stagger calls to avoid rate limits
  if (index > 0) await delay(600);

  const attempt = async (): Promise<ClaudeCaption> => {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

    // Strip markdown fences if Claude adds them despite instruction
    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    return JSON.parse(clean) as ClaudeCaption;
  };

  try {
    return await attempt();
  } catch {
    // One retry
    await delay(1000);
    return await attempt();
  }
}
