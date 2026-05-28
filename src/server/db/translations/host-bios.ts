/**
 * Bilingual translations for the 3 seeded host bios. Source is English;
 * Vietnamese brand-voice translation by subagent T5.
 *
 * Keyed by `host_profiles.public_slug` (slugify(displayName)) so the
 * backfill UPDATE can match a row in prod regardless of UUID.
 *
 * Consumed by:
 *   - seed.ts (writes both `bio_vi` / `bio_en` columns on insert)
 *   - scripts/backfill-bilingual-content.ts (UPDATE for prod rows by slug)
 */
export interface HostBioTranslation {
  displayName: string;
  bio: { vi: string; en: string };
}

export const HOST_BIO_TRANSLATIONS: Record<string, HostBioTranslation> = {
  "nguyen-hoang-nam": {
    displayName: "Nguyen Hoang Nam",
    bio: {
      vi: "Tín đồ ẩm thực vỉa hè, kẻ mê khung hình. Mỗi con ngõ khuất trong Phố cổ Hà Nội tôi đều thuộc như lòng bàn tay.",
      en: "Street food guru and photography lover. I know every hidden alley in the Old Quarter.",
    },
  },
  "tran-linh": {
    displayName: "Tran Linh",
    bio: {
      vi: "Sinh viên ngành sử, mê kể câu chuyện nghìn năm của Hà thành cho những lữ khách bốn phương.",
      en: "History student who loves sharing Hanoi's 1000-year story with travelers from around the world.",
    },
  },
  "le-minh-chau": {
    displayName: "Le Minh Chau",
    bio: {
      vi: "Nghiện cà phê, mê nghệ thuật. Để tôi dẫn bạn đến những quán xá và phòng tranh mà du khách chẳng bao giờ tìm thấy.",
      en: "Coffee addict and art lover. Let me show you the cafes and galleries tourists never find.",
    },
  },
};
