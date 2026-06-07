export type PlaceRow = {
  id: string;
  address: string | null;
  category: string;
  descriptionEn: string | null;
  descriptionVi: string | null;
  isActive: boolean | null;
  isVerified: boolean | null;
  latitude: number;
  longitude: number;
  name: string;
  nameEn: string | null;
  nameVi: string | null;
  photos: string[] | null;
  priceRange: string | null;
};

export type FixedTourRow = {
  tourId: string;
  basePriceVnd: number;
  chapter: string;
  durationMinutes: number;
  isActive: boolean;
  maxParticipants: number;
  minParticipants: number;
  storyScriptEn: string;
  storyScriptVi: string;
  titleEn: string;
  titleVi: string;
  vector?: unknown;
};

export type TemplateRow = {
  templateId: string;
  basePriceVnd: number;
  durationMinutes: number;
  isActive: boolean;
  maxParticipants: number;
  storyEn: string;
  storyVi: string;
  subtitleEn: string | null;
  subtitleVi: string | null;
  theme: string;
  titleEn: string;
  titleVi: string;
  vector?: unknown;
};
