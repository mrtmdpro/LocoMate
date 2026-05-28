/**
 * Bilingual translations for the 6 merch entries in `productSeeds`
 * (seed.ts). Source is English; Vietnamese brand-voice translation by
 * subagent T4.
 *
 * Variants (size/color labels) intentionally stay single-language —
 * they're SKU-level metadata, not customer-facing prose.
 *
 * Consumed by:
 *   - seed.ts (writes both `_vi` / `_en` columns on insert)
 *   - scripts/backfill-bilingual-content.ts (UPDATE for prod rows by slug)
 */
export interface ProductTranslation {
  title: { vi: string; en: string };
  subtitle: { vi: string; en: string };
  description: { vi: string; en: string };
}

export const PRODUCT_TRANSLATIONS: Record<string, ProductTranslation> = {
  "old-quarter-tee": {
    title: {
      vi: "Áo phông Phố cổ",
      en: "Old Quarter Tee",
    },
    subtitle: {
      vi: "In phong cách street art, cotton đã xử lý co rút",
      en: "Street art print, pre-shrunk cotton",
    },
    description: {
      vi: "Bản vẽ nét tối giản về Tạ Hiện lúc 9 giờ tối, in trên áo phông cotton 100%. In tại một xưởng nhỏ ở Bắc Ninh. Form Á — chúng tôi mặc định lên một size cho bạn.",
      en: "A minimal line drawing of Ta Hien at 9 PM on a 100% cotton tee. Printed in a small Bac Ninh workshop. Sizes run Asian-fit -- we size up by default.",
    },
  },

  "pho-queue-cap": {
    title: {
      vi: "Mũ xếp hàng phở",
      en: "Pho Queue Cap",
    },
    subtitle: {
      vi: "Xanh navy phai nắng, thêu hình tô phở",
      en: "Sun-bleached navy with embroidered pho bowl",
    },
    description: {
      vi: "Chiếc mũ mà ông nào ở Hà Nội cũng đội khi xếp hàng phở 6 giờ sáng, chỉ là không kèm vệt mồ hôi. Đỉnh sau điều chỉnh được, mặt trước thêu tay.",
      en: "The cap every Hanoian grandpa wears queueing for pho at 6 AM, minus the sweat stains. Adjustable back, embroidered front.",
    },
  },

  "alley-map-tote": {
    title: {
      vi: "Túi tote bản đồ ngõ phố",
      en: "Alley Map Tote",
    },
    subtitle: {
      vi: "Bản đồ 36 phố phường vẽ tay",
      en: "A hand-drawn map of the 36 streets",
    },
    description: {
      vi: "Túi tote vải canvas, mặt sau in lụa bản đồ 36 phố phường Phố cổ vẽ tay. Đủ chỗ cho laptop, hộp cơm và mấy món quà lưu niệm.",
      en: "Canvas tote with a hand-drawn map of the Old Quarter's 36 streets silkscreened on the back. Fits a laptop + lunch + souvenirs.",
    },
  },

  "motorbike-keychain": {
    title: {
      vi: "Móc khoá xe máy",
      en: "Motorbike Keychain",
    },
    subtitle: {
      vi: "Pin men hình chiếc Honda Dream",
      en: "Enamel pin of a Honda Dream",
    },
    description: {
      vi: "Móc khoá men hoàn thiện thủ công, hình chiếc Honda Dream — chiếc xe đã dựng nên Hà Nội. Đóng gói trong phong bì giấy kraft tái chế.",
      en: "Hand-finished enamel keychain of the Honda Dream -- the motorbike that built Hanoi. Packaged in a recycled kraft envelope.",
    },
  },

  "travelers-journal": {
    title: {
      vi: "Sổ tay người đi đường",
      en: "Traveler's Journal",
    },
    subtitle: {
      vi: "Giấy chấm, dây thun, đã thử qua quán cà phê",
      en: "Dotted pages, elastic band, cafe-tested",
    },
    description: {
      vi: "Sổ tay A6 ruột chấm, dây thun da, giấy tái chế 180 GSM. Đủ chỗ ghi chú cho khoảng 120 điểm dừng.",
      en: "A6 dotted-page journal, leather elastic band, 180 GSM recycled paper. Room for 120 stops' worth of notes.",
    },
  },

  "hanoi-poster-print": {
    title: {
      vi: "Tranh in Hà Nội",
      en: "Hanoi Poster Print",
    },
    subtitle: {
      vi: "Tranh in giclée khổ A2, bản giới hạn đánh số 200",
      en: "A2 giclee print, numbered edition of 200",
    },
    description: {
      vi: "Tranh in giclée trên giấy Hahnemühle 310 GSM, khổ A2, có chữ ký và đánh số. Chủ đề: cầu Long Biên lúc bình minh. Đóng gói phẳng khi giao.",
      en: "Giclee art print on 310 GSM Hahnemuhle paper, A2 size, signed and numbered. Subject: Long Bien Bridge at dawn. Ships flat.",
    },
  },
};
