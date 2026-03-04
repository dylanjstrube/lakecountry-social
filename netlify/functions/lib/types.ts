export type Season = "winter" | "spring" | "summer" | "fall";
export type ProductLine = "enhance" | "select" | "transcend";
export type ImageType = "product" | "lifestyle" | "before-after";
export type BeforeAfterRole = "before" | "after";
export type CtaType = "website" | "phone";

export interface DailyContext {
  date: string;
  season: Season;
  productSpotlight: ProductLine;
  weatherNote: string;
  upcomingHoliday?: string;
  promotionNote?: string;
}

export interface OverlayConfig {
  headlineText: string;
  headlineFontSize: number;
  bodyText: string;
  bodyFontSize: number;
}

export interface DraftPost {
  id: string;
  date: string;
  index: number;
  imagePath: string;
  imageSource: "local" | "ai-generated";
  imageType: ImageType;
  beforeAfterRole?: BeforeAfterRole;
  beforeAfterPairId?: string;
  colorName?: string;
  productLine?: ProductLine;
  overlayConfig: OverlayConfig;
  caption: string;
  hashtags: string[];
  ctaType: CtaType;
  context: DailyContext;
}

export interface PublishedPost {
  draftId: string;
  date: string;
  publishedAt: string;
  facebookPostId: string;
  instagramMediaId: string;
  caption: string;
  imagePath: string;
}

export interface ManifestImage {
  path: string;
  source: "local" | "ai-generated";
  type: ImageType;
  productLine?: ProductLine;
  colorName?: string;
  beforeAfterRole?: BeforeAfterRole;
  beforeAfterPairId?: string;
  tags: string[];
  season: string[];
}

export interface ImageManifest {
  images: ManifestImage[];
}

export interface ClaudeCaption {
  headlineText: string;
  caption: string;
  hashtags: string[];
  ctaText: string;
}
