# Lake Country Decking — Social Media Automation Agent

## Purpose
Automated social media content system for Lake Country Decking. Every 3 days, it:
1. Generates 10 post options (image + AI copy) via a Netlify Background Function
2. Emails the owner a link to a review portal
3. Owner picks one post from the portal
4. System publishes to Facebook + Instagram via Meta Graph API

## Business Info
- **Company:** Lake Country Decking — Trex composite deck resurfacing, Delafield WI
- **Phone:** (920) 355-2174
- **Email:** lakecountrydecking@gmail.com
- **Website:** https://www.lakecountrydecking.com
- **Service area:** Delafield, Pewaukee, Oconomowoc, Hartland, Waukesha, Southeastern WI

## Tech Stack
- **Language:** Node.js / TypeScript (ESM)
- **Hosting:** Netlify (separate site from deckWebsite)
- **Functions:** Netlify Scheduled + Background Functions
- **Storage:** Netlify Blobs (drafts + published image store)
- **AI copy:** Claude API via `@anthropic-ai/sdk` (claude-haiku model)
- **AI images:** Flux 2 / Stability AI (static), Runway Gen-4 Turbo (video — Phase 2)
- **Social posting:** Meta Graph API — Facebook Pages API + Instagram Graph API (2 separate calls)
- **Notification:** Netlify Forms (no SendGrid needed)
- **Portal:** Vanilla HTML/CSS/JS, Canvas API for image composition

## Directory Structure
```
lakecountry-social/
├── CLAUDE.md                               ← this file
├── netlify.toml                            ← Netlify config + cron schedule
├── package.json                            ← dependencies
├── tsconfig.json                           ← TypeScript config
├── .env.example                            ← env var template (never commit .env)
│
├── portal/                                 ← Owner review portal (Netlify publish dir)
│   ├── index.html                          ← Review UI + hidden Netlify notification form
│   ├── portal.css                          ← Styles (brand colors from deckWebsite)
│   └── portal.js                           ← Canvas compose + draft loading + publish
│
├── images/                                 ← Local image library
│   ├── manifest.json                       ← Image metadata (type, before/after, tags)
│   ├── before-after/                       ← Owner-provided project photos (pairs)
│   ├── lifestyle/                          ← General deck/outdoor lifestyle shots
│   └── products/                           ← Trex color hero shots
│
├── scripts/
│   └── test-prompt.ts                      ← Standalone Claude prompt tester
│
└── netlify/
    └── functions/
        ├── generate-drafts-trigger.mts     ← Scheduled cron → kicks off background fn
        ├── generate-drafts-background.mts  ← Claude calls + Blobs write + email
        ├── get-drafts.mts                  ← Portal API: returns today's DraftPost[]
        ├── publish-post.mts                ← Uploads image + posts to Meta
        └── lib/
            ├── types.ts                    ← Shared TypeScript interfaces
            ├── context.ts                  ← Daily context: season, holidays, rotation
            ├── image-selector.ts           ← Smart image picker (before/after aware)
            ├── claude.ts                   ← Claude API wrapper + prompt builder
            ├── image-gen.ts                ← Flux 2 / Stability AI image generation
            ├── meta-api.ts                 ← Facebook + Instagram Graph API helpers
            └── blobs.ts                    ← @netlify/blobs thin wrapper
```

## Design System (matches deckWebsite)
CSS variables used in portal.css:
| Variable        | Value     | Usage                        |
|-----------------|-----------|------------------------------|
| `--forest`      | `#1a2e1a` | Dark headings, nav           |
| `--trex-green`  | `#2d5a27` | Primary brand green, CTA bar |
| `--trex-light`  | `#4a8f40` | Lighter green                |
| `--sand`        | `#f5ede0` | Warm sand background         |
| `--warm-white`  | `#faf8f4` | Page background              |
| `--charcoal`    | `#2a2a2a` | Body text                    |
| `--accent`      | `#c8a96e` | Gold — available, not currently used on canvas |

Google Fonts: **Playfair Display** (headlines) · **DM Sans** (body) — same as deckWebsite.

## Netlify Blobs Schema
| Store | Key | Value |
|-------|-----|-------|
| `social-drafts` | `drafts/{YYYY-MM-DD}` | `DraftPost[]` JSON (10 items) |
| `social-drafts` | `published/{YYYY-MM-DD}` | `PublishedPost` JSON |
| `social-drafts` | `image-usage/{imagePath}` | Last used date string |
| `social-images` (public) | `{date}/{draftId}.jpg` | Composed 1080×1080 JPEG |

## Environment Variables
Set all of these in Netlify Dashboard → Environment Variables:

```
ANTHROPIC_API_KEY=          # Claude API key
FLUX_API_KEY=               # Flux 2 API key (or STABILITY_API_KEY for Stability AI)
META_PAGE_ACCESS_TOKEN=     # Non-expiring Facebook Page Access Token
META_PAGE_ID=               # Facebook Page ID
META_IG_USER_ID=            # Instagram Business Account ID
META_APP_ID=                # Meta App ID (for token refresh)
META_APP_SECRET=            # Meta App Secret
META_DELAFIELD_PLACE_ID=    # Optional: Facebook Place ID for Delafield, WI (location tagging)
                            # Find via: GET /search?type=place&q=Delafield+WI&fields=name,id
URL=                        # Set automatically by Netlify (your site URL)
```

## Meta API Setup (one-time)
1. developers.facebook.com → Create App → Business → "LCD Social Poster"
2. Add "Instagram Graph API" product
3. Graph API Explorer → User Access Token with permissions:
   `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`
4. Exchange for Long-Lived User Token → GET /me/accounts → copy Page ID + Page Access Token
5. GET /{PAGE_ID}?fields=instagram_business_account → copy IG User ID
6. Add all values to Netlify environment variables

## CTA Strategy
- 8 of 10 posts per batch → website: `www.lakecountrydecking.com`
- 2 of 10 posts per batch → phone: `(920) 355-2174`
- Facebook posts include a native **"Get Quote"** CTA button (`call_to_action: GET_QUOTE`) linking to the website
- Instagram organic posts do not support native CTA buttons via Graph API — website URL is prominent in caption

## Canvas Composition (1080×1080px JPEG)
1. Source image (cover-fit)
2. **Headline only** — no body copy on canvas
3. Centered semi-transparent black box (`rgba(0,0,0,0.40)`, 18px rounded corners) sized to fit the headline
4. Headline — Playfair Display bold, white (#ffffff), centered H+V inside the box
   - Font: 112px (≤20 chars) · 88px (≤35 chars) · 68px (>35 chars)
5. Bottom banner — trex-green (#2d5a27) bar, 72px tall, white DM Sans 600 28px
   - Text: "Resurface your existing deck · Free Quotes - Serving SE WI"

## Portal Card Display
Badges shown per card: **Before/After/Lifestyle type badge only**
Removed: Trex product line badge, Website/Phone CTA badge, color name label

## Content Strategy (claude.ts)
- Headlines focused on **deck resurfacing** — transforming old worn wood decks with Trex composite
- 10 tone variants per batch, each a distinct emotional angle (no two posts share the same hook):
  - Pain-point, Seasonal urgency, Aspirational, Neighborhood pride, Financial/value,
    Time liberation, Transformation, Local/community, Holiday/entertaining, FOMO
- Seasonal context used aggressively in every headline
- No product line tags, no color tags, no email/phone in generated copy

## Claude Code Skill
`/generate-posts` — project skill at `.claude/commands/generate-posts.md`
Invoke to generate a full 10-post batch with all business rules and seasonal context baked in.

## Scheduling
Cron: `0 13 */3 * *` = every 3 days at 7 AM CT (UTC-6)

## Testing Locally
```bash
npm install -g netlify-cli
netlify dev
# Test background function:
curl -X POST http://localhost:8888/.netlify/functions/generate-drafts-background
# View portal:
open http://localhost:8888/
```

## Monthly Cost Estimate (Phase 1)
- Claude API (haiku, ~100 calls/mo): ~$0.50
- Flux 2 image generation (~100 AI images/mo): ~$5–7
- Netlify (Functions, Blobs, Forms): Free tier
- Meta Graph API: Free
- **Total: ~$6–8/month**
