/**
 * Brand-canonical Fixed Tour categories (Phase A.3).
 *
 * Replaces the previous free-text `experiences.category` taxonomy with
 * three "biên độ cảm xúc" buckets pulled from
 * [docs/dav startup .md](docs/dav%20startup%20.md). Tours stored under
 * other category strings (existing seed data) still render — they just
 * surface in an "Other" tab on the experiences page.
 *
 * Each category owns:
 *   - `slug`     — the value stored in `experiences.category`.
 *   - `label`    — the Vietnamese display name (italic-serif on cards).
 *   - `tagline`  — sans-serif eyebrow under the label.
 *   - `summary`  — one-sentence brand description for the category card.
 *   - `illus`    — which @/components/brand illustration to render.
 *   - `accent`   — which brand colour token drives the active state.
 */

export type FixedTourCategorySlug =
  | "thanh-tao-xu-bac"
  | "hon-dat-nghe-nhan"
  | "huong-men-nong-say";

export type FixedTourCategory = {
  slug: FixedTourCategorySlug;
  label: string;
  tagline: string;
  summary: string;
  /** Names a component exported by `@/components/brand`. The consuming
   *  surface decides the size; we keep the type loose to avoid a JSX
   *  import here (this file is read by server-side code too). */
  illus: "ConicalHat" | "MamCom" | "PhinFilter";
  accent: "brick" | "terracotta" | "mustard";
};

export const FIXED_TOUR_CATEGORIES: readonly FixedTourCategory[] = [
  {
    slug: "thanh-tao-xu-bac",
    label: "Thanh Tao Xứ Bắc",
    tagline: "Kiến trúc · di sản",
    summary:
      "Đi qua các bức tường rêu phong, đình đài, nhà cổ. Cho người muốn đọc Hà Nội như một quyển sách.",
    illus: "ConicalHat",
    accent: "brick",
  },
  {
    slug: "hon-dat-nghe-nhan",
    label: "Hồn Đất Nghệ Nhân",
    tagline: "Làng nghề · thủ công",
    summary:
      "Trực tiếp chạm tay vào gốm, lụa, tranh sơn mài. Cho người muốn ngồi xuống cùng nghệ nhân.",
    illus: "MamCom",
    accent: "terracotta",
  },
  {
    slug: "huong-men-nong-say",
    label: "Hương Men Nồng Say",
    tagline: "Ẩm thực ngách",
    summary:
      "Những món ăn ấp ủ nghìn năm lịch sử — chỉ người sành ăn Hà Nội mới biết. Vị giác là cửa ngõ.",
    illus: "PhinFilter",
    accent: "mustard",
  },
] as const;

export function getFixedTourCategory(slug: string): FixedTourCategory | undefined {
  return FIXED_TOUR_CATEGORIES.find((c) => c.slug === slug);
}

/** Set of all brand-canonical slugs, for fast `categories.has(value)` checks. */
export const FIXED_TOUR_CATEGORY_SLUGS = new Set<string>(
  FIXED_TOUR_CATEGORIES.map((c) => c.slug),
);
