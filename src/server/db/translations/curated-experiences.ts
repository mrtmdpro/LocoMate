/**
 * Bilingual translations for the 9 legacy curated experiences in
 * `experiencesData` (seed.ts). Three are brand-canonical Vietnamese
 * (passed through); six were English-only legacy seeds and have been
 * translated to Vietnamese in brand voice by subagent T2.
 *
 * Consumed by:
 *   - seed.ts (writes both `_vi` / `_en` columns on insert)
 *   - scripts/backfill-bilingual-content.ts (UPDATE for prod rows)
 */
export interface CuratedExperienceTranslation {
  title: { vi: string; en: string };
  subtitle: { vi: string; en: string };
  description: { vi: string; en: string };
  highlights: { vi: string[]; en: string[] };
  included: { vi: string[]; en: string[] };
  schedule: {
    vi: { time: string; label: string }[];
    en: { time: string; label: string }[];
  };
}

export const CURATED_EXPERIENCE_TRANSLATIONS: Record<string, CuratedExperienceTranslation> = {
  // ----------------------------------------------------------------------
  // Brand-canonical Vietnamese — VI verbatim, EN freshly translated.
  // ----------------------------------------------------------------------
  "thanh-tao-xu-bac-walk": {
    title: {
      vi: "Thanh Tao Xứ Bắc — Đình đài Hà Nội",
      en: "Thanh Tao Xứ Bắc — Old Halls of Hà Nội",
    },
    subtitle: {
      vi: "Tường rêu phong, đình cổ, nhà số 87",
      en: "Mossy walls, ancient communal houses, and the home at No. 87",
    },
    description: {
      vi: "Một sáng đi qua các bức tường rêu phong, đình đài, nhà cổ phố Mã Mây — đọc Hà Nội như một quyển sách. Local guide kể chuyện về kiến trúc Pháp, mái đình Lý-Trần, và một căn nhà 87 Mã Mây mở cửa cho khách bước vào.",
      en: "A slow morning along mossy walls, communal halls, and old townhouses on Mã Mây street — reading Hà Nội like a book. A local guide unfolds stories of French colonial architecture, Lý–Trần dynasty roof lines, and the door at 87 Mã Mây that opens for those who pause.",
    },
    highlights: {
      vi: [
        "Tường rêu phong phố cổ",
        "Nhà cổ 87 Mã Mây",
        "Đình Bạch Mã",
        "Lịch sử kiến trúc Pháp-Hà Nội",
      ],
      en: [
        "Mossy walls of the Old Quarter",
        "The 87 Mã Mây heritage house",
        "Bạch Mã Temple",
        "French–Hà Nội architectural history",
      ],
    },
    included: {
      vi: ["Local guide", "Vé vào nhà cổ", "Trà nóng nghỉ chân"],
      en: ["Local guide", "Heritage house entry ticket", "Hot tea rest stop"],
    },
    schedule: {
      vi: [
        { time: "08:00", label: "Tập trung Hoàn Kiếm" },
        { time: "08:30", label: "Đình Bạch Mã" },
        { time: "09:30", label: "Nhà 87 Mã Mây" },
        { time: "10:30", label: "Trà nghỉ chân" },
      ],
      en: [
        { time: "08:00", label: "Meet at Hoàn Kiếm" },
        { time: "08:30", label: "Bạch Mã Temple" },
        { time: "09:30", label: "87 Mã Mây House" },
        { time: "10:30", label: "Tea break" },
      ],
    },
  },

  "hon-dat-nghe-nhan-bat-trang": {
    title: {
      vi: "Hồn Đất Nghệ Nhân — Gốm Bát Tràng",
      en: "Hồn Đất Nghệ Nhân — Bát Tràng Ceramics",
    },
    subtitle: {
      vi: "Chạm tay vào đất, đi cùng người nghệ nhân",
      en: "Hands in the clay, beside a true artisan",
    },
    description: {
      vi: "Đến làng gốm Bát Tràng cùng một nghệ nhân thế hệ thứ tư. Tự tay nặn, vẽ men, và mang về một tác phẩm gốm thật của chính mình. Câu chuyện kể về 700 năm lò Bát Tràng, qua khói đất nung.",
      en: "Travel to the ceramic village of Bát Tràng with a fourth-generation artisan. Shape your own piece on the wheel, paint your own glaze, and carry home a ceramic that is truly yours. Across the day, a quiet story unfolds — seven hundred years of Bát Tràng kilns, told through smoke and fired earth.",
    },
    highlights: {
      vi: [
        "Tự nặn gốm với nghệ nhân",
        "Đi giữa các lò nung 700 năm",
        "Mang gốm của mình về",
        "Bữa trưa gia đình nghệ nhân",
      ],
      en: [
        "Shape your own ceramic alongside a master artisan",
        "Walk among 700-year-old kilns",
        "Take home a piece you made yourself",
        "Family lunch in the artisan's home",
      ],
    },
    included: {
      vi: ["Xe đưa đón", "Vật liệu gốm", "Bữa trưa", "Đóng gói gốm mang về"],
      en: [
        "Round-trip transport",
        "Ceramic materials",
        "Lunch",
        "Packing for your piece to travel home",
      ],
    },
    schedule: {
      vi: [
        { time: "09:00", label: "Đón ở Hoàn Kiếm" },
        { time: "10:00", label: "Đến Bát Tràng" },
        { time: "10:30", label: "Nặn gốm" },
        { time: "12:30", label: "Bữa trưa" },
        { time: "13:30", label: "Về Hà Nội" },
      ],
      en: [
        { time: "09:00", label: "Pickup at Hoàn Kiếm" },
        { time: "10:00", label: "Arrive in Bát Tràng" },
        { time: "10:30", label: "Throwing the clay" },
        { time: "12:30", label: "Lunch" },
        { time: "13:30", label: "Return to Hà Nội" },
      ],
    },
  },

  "huong-men-nong-say-bun-dau": {
    title: {
      vi: "Hương Men Nồng Say — Bún Đậu & Phở Đêm",
      en: "Hương Men Nồng Say — Bún Đậu & Late-Night Phở",
    },
    subtitle: {
      vi: "Ẩm thực ngách Hà Nội — chỉ người sành ăn biết",
      en: "Hà Nội's back-alley table — known only to the true eaters",
    },
    description: {
      vi: "Một food tour ngách: bún đậu mắm tôm lề đường, phở gánh đêm trên Lý Quốc Sư, chè cốm Tràng Tiền. Không quán du lịch, không Google review — chỉ những địa chỉ người Hà Nội thật sự đến.",
      en: "A back-alley food tour: roadside bún đậu mắm tôm, a phở-gánh vendor on Lý Quốc Sư after dark, and chè cốm on Tràng Tiền. No tourist menus, no Google reviews — only the addresses Hanoians themselves actually go to.",
    },
    highlights: {
      vi: [
        "Bún đậu mắm tôm trong ngõ",
        "Phở gánh đêm Lý Quốc Sư",
        "Chè cốm Tràng Tiền",
        "5 món ăn nghìn năm tuổi",
      ],
      en: [
        "Bún đậu mắm tôm tucked inside an alley",
        "Late-night phở-gánh on Lý Quốc Sư",
        "Chè cốm on Tràng Tiền",
        "Five dishes, a thousand years old",
      ],
    },
    included: {
      vi: ["Local guide sành ăn", "5 món ăn", "Trà đá vỉa hè", "Đi bộ + xích lô"],
      en: [
        "A local guide who eats like one",
        "Five tastings",
        "Sidewalk iced tea",
        "On foot + cyclo",
      ],
    },
    schedule: {
      vi: [
        { time: "18:00", label: "Tập trung Đồng Xuân" },
        { time: "18:30", label: "Bún đậu ngõ" },
        { time: "19:30", label: "Phở gánh đêm" },
        { time: "20:30", label: "Chè cốm" },
      ],
      en: [
        { time: "18:00", label: "Meet at Đồng Xuân" },
        { time: "18:30", label: "Bún đậu in the alley" },
        { time: "19:30", label: "Night phở-gánh" },
        { time: "20:30", label: "Chè cốm" },
      ],
    },
  },

  // ----------------------------------------------------------------------
  // Legacy English-only — EN verbatim, VI freshly translated in brand voice.
  // ----------------------------------------------------------------------
  "breakfast-like-a-hanoian": {
    title: {
      vi: "Bữa Sáng Như Người Hà Nội",
      en: "Breakfast Like a Hanoian",
    },
    subtitle: {
      vi: "Đi chợ sớm cùng một bà nội Hà Nội",
      en: "Morning Market Run with a Local Grandma",
    },
    description: {
      vi: "Năm rưỡi sáng dậy, theo chân một bà nội Hà Nội đã nghỉ hưu ra chợ cóc đầu ngõ. Học bà cách chọn nắm rau thơm còn đẫm sương, mặc cả vài câu, và nhận ra con cá nào tươi nhất trong rổ. Cuối buổi, cùng nhau nấu nồi phở và ngồi ăn ngay trong căn bếp của bà.",
      en: "Wake up at 5:30 AM and accompany a retired Hanoian grandmother to her neighborhood wet market. Learn how she picks the freshest herbs, negotiates prices, and judges a good fish. End with cooking and eating pho together at her home.",
    },
    highlights: {
      vi: [
        "Chợ cóc tinh mơ Hà Nội",
        "Học cách chọn nguyên liệu tươi",
        "Tự tay nấu một nồi phở",
        "Bữa sáng cùng một gia đình Hà Nội thật",
      ],
      en: [
        "Visit a local wet market at dawn",
        "Learn to pick fresh ingredients",
        "Cook pho from scratch",
        "Eat breakfast with a real Hanoi family",
      ],
    },
    included: {
      vi: [
        "Bà nội chủ nhà kiêm người dẫn",
        "Toàn bộ nguyên liệu",
        "Bữa sáng tại nhà",
        "Phiếu công thức mang về",
      ],
      en: ["Local guide/grandma host", "All ingredients", "Breakfast meal", "Recipe card"],
    },
    schedule: {
      vi: [
        { time: "05:30", label: "Hẹn ở phố cổ" },
        { time: "06:00", label: "Đi chợ cóc" },
        { time: "07:00", label: "Vào bếp nấu phở" },
        { time: "08:00", label: "Cùng nhau ăn sáng" },
      ],
      en: [
        { time: "05:30", label: "Meet at Old Quarter" },
        { time: "06:00", label: "Wet market tour" },
        { time: "07:00", label: "Cooking session" },
        { time: "08:00", label: "Breakfast together" },
      ],
    },
  },

  "the-family-table": {
    title: {
      vi: "Mâm Cơm Nhà",
      en: "The Family Table",
    },
    subtitle: {
      vi: "Bữa trưa cùng một gia đình Hà Nội",
      en: "Lunch with a Hanoi Family",
    },
    description: {
      vi: "Ngồi vào mâm cơm của một gia đình Hà Nội thật, trong căn nhà ống ngay phố cổ. Không lớp nấu ăn dàn dựng, không gian bếp diễn — chỉ là bữa cơm Chủ Nhật bình thường, ba thế hệ quây quanh một mâm.",
      en: "Join a real Hanoian family for a home-cooked lunch in their Old Quarter townhouse. No cooking class setup, no staged kitchen — just their actual Sunday meal with 3 generations at the table.",
    },
    highlights: {
      vi: [
        "Ăn cơm cùng ba thế hệ",
        "Mâm cơm nhà nấu thật",
        "Nghe ông bà kể chuyện xưa",
        "Mang về tờ công thức viết tay",
      ],
      en: [
        "Dine with 3 generations",
        "Home-cooked authentic lunch",
        "Hear real stories from elders",
        "Take home a handwritten recipe",
      ],
    },
    included: {
      vi: [
        "Mâm cơm nhà nấu trọn vẹn",
        "Chủ nhà kiêm người dẫn",
        "Phiếu công thức",
        "Trà và món tráng miệng",
      ],
      en: ["Full home-cooked lunch", "Family host + guide", "Recipe card", "Tea and dessert"],
    },
    schedule: {
      vi: [
        { time: "11:30", label: "Gặp tại nhà chủ" },
        { time: "12:00", label: "Vào bữa trưa" },
        { time: "13:30", label: "Uống trà và tạm biệt" },
      ],
      en: [
        { time: "11:30", label: "Meet at family home" },
        { time: "12:00", label: "Lunch" },
        { time: "13:30", label: "Tea and farewell" },
      ],
    },
  },

  "rice-paddy-morning": {
    title: {
      vi: "Sáng Trên Đồng Lúa",
      en: "Rice Paddy Morning",
    },
    subtitle: {
      vi: "Lội ruộng ngoại thành Hà Nội",
      en: "Farm Work in Suburban Hanoi",
    },
    description: {
      vi: "Ba mươi phút xe ra khỏi nội thành, đến một thửa ruộng nhà ở Đông Anh. Ba tiếng xắn quần cấy lúa hoặc gặt theo mùa, nghe câu chuyện về lịch trăng nông nghiệp, rồi ngồi xuống ăn một bữa cơm quê ngay tại nhà bác chủ ruộng.",
      en: "Drive 30 minutes outside the city to a family rice farm in Dong Anh. Spend 3 hours planting or harvesting rice, learn about the lunar agricultural calendar, and eat a farmhouse lunch.",
    },
    highlights: {
      vi: [
        "Lội ruộng cấy gặt thật",
        "Học lịch nông trăng",
        "Bữa cơm quê tại nhà bác chủ",
        "Đường ra ngoại thành xanh mướt",
      ],
      en: [
        "Real rice farming",
        "Learn the lunar calendar",
        "Farmhouse lunch",
        "Scenic countryside drive",
      ],
    },
    included: {
      vi: [
        "Xe đưa đón hai chiều",
        "Dụng cụ nhà nông",
        "Bữa cơm tại nhà",
        "Người dẫn địa phương",
      ],
      en: ["Round-trip transport", "Farming equipment", "Farmhouse lunch", "Local guide"],
    },
    schedule: {
      vi: [
        { time: "07:00", label: "Đón khách" },
        { time: "07:30", label: "Xe ra đồng" },
        { time: "08:00", label: "Xuống ruộng" },
        { time: "10:30", label: "Bữa trưa quê" },
      ],
      en: [
        { time: "07:00", label: "Pickup" },
        { time: "07:30", label: "Drive to farm" },
        { time: "08:00", label: "Farm work" },
        { time: "10:30", label: "Lunch" },
      ],
    },
  },

  "the-wedding-crasher": {
    title: {
      vi: "Khách Lạ Trong Đám Cưới",
      en: "The Wedding Crasher",
    },
    subtitle: {
      vi: "Dự một đám cưới Việt thật",
      en: "Attend a Real Vietnamese Wedding",
    },
    description: {
      vi: "Đám cưới ở Việt Nam là những bữa tiệc mở cửa, thêm một mâm vài người không ai bận tâm. Đi cùng chủ nhà, dự lễ ra mắt trà rượu, ngồi vào mâm mười món, hát karaoke với cô chú, và sống trọn cái náo nhiệt rất Việt của một ngày trọng đại.",
      en: "Vietnamese weddings are massive open-door banquets where extra guests are welcomed. Experience the tea ceremony, the 10-course banquet, the karaoke, and the chaos.",
    },
    highlights: {
      vi: [
        "Một đám cưới Việt thật",
        "Mâm cỗ mười món",
        "Hát karaoke cùng họ hàng",
        "Trao đổi văn hoá trước buổi tiệc",
      ],
      en: [
        "Real Vietnamese wedding",
        "10-course banquet",
        "Karaoke with family",
        "Cultural briefing",
      ],
    },
    included: {
      vi: [
        "Tư vấn trang phục",
        "Người dẫn văn hoá",
        "Bữa tiệc mâm cỗ",
        "Phong bì mừng cô dâu chú rể",
      ],
      en: ["Outfit advice", "Cultural guide", "Banquet dinner", "Gift for couple"],
    },
    schedule: {
      vi: [
        { time: "17:00", label: "Trao đổi văn hoá" },
        { time: "17:30", label: "Di chuyển đến nhà hàng" },
        { time: "18:00", label: "Lễ trà rượu" },
        { time: "19:00", label: "Vào mâm cỗ" },
      ],
      en: [
        { time: "17:00", label: "Cultural briefing" },
        { time: "17:30", label: "Travel to venue" },
        { time: "18:00", label: "Tea ceremony" },
        { time: "19:00", label: "Banquet" },
      ],
    },
  },

  "dawn-on-the-red-river": {
    title: {
      vi: "Bình Minh Sông Hồng",
      en: "Dawn on the Red River",
    },
    subtitle: {
      vi: "Lên thuyền chài đón ban mai",
      en: "Fisherman's Boat at Sunrise",
    },
    description: {
      vi: "Năm giờ sáng, bước lên một chiếc thuyền gỗ nhỏ giữa sông Hồng cùng người chài đời thứ ba. Cùng quăng lưới, nhìn mặt trời nhô lên sau cầu Long Biên, rồi ngồi xuống ăn bát phở nóng ngay bên mép sông.",
      en: "Board a small wooden fishing boat on the Red River at 5 AM with a third-generation fisherman. Help cast nets, watch the sun rise over Long Bien Bridge, and eat riverside pho.",
    },
    highlights: {
      vi: [
        "Đón bình minh giăng lưới trên sông Hồng",
        "Học cách quăng lưới chài",
        "Mặt trời lên trên cầu Long Biên",
        "Quán phở chỉ dân chài biết",
      ],
      en: [
        "Sunrise fishing on Red River",
        "Learn net-casting",
        "Sunrise over Long Bien Bridge",
        "Fishermen-only pho stall",
      ],
    },
    included: {
      vi: ["Thuyền chài", "Người chài kiêm hướng dẫn", "Bát phở bên sông", "Áo phao"],
      en: ["Fishing boat", "Fisherman guide", "Riverside pho", "Life jacket"],
    },
    schedule: {
      vi: [
        { time: "05:00", label: "Hẹn ở bến" },
        { time: "05:15", label: "Lên thuyền" },
        { time: "06:00", label: "Đón bình minh + quăng lưới" },
        { time: "07:30", label: "Phở sáng bên sông" },
      ],
      en: [
        { time: "05:00", label: "Meet at dock" },
        { time: "05:15", label: "Board boat" },
        { time: "06:00", label: "Sunrise + fishing" },
        { time: "07:30", label: "Pho breakfast" },
      ],
    },
  },

  "the-night-shift": {
    title: {
      vi: "Ca Đêm",
      en: "The Night Shift",
    },
    subtitle: {
      vi: "Hà Nội hai giờ sáng — phía sau ánh đèn",
      en: "Behind-the-Scenes at Hanoi's 2AM Economy",
    },
    description: {
      vi: "Hà Nội chưa bao giờ thực sự ngủ. Hai giờ sáng ghé chợ hoa Quảng Bá, ba giờ nhìn lò bánh mì đỏ rực than, gặp các cô lao công làm chủ những con đường vắng, rồi năm rưỡi sáng — mở đầu một ngày mới bằng ly cà phê đầu tiên.",
      en: "Hanoi never sleeps. Visit the wholesale flower market at 2 AM, watch bread bakers fire ovens at 3 AM, meet the street sweepers who own the empty streets, and end with the first coffee at 5:30 AM.",
    },
    highlights: {
      vi: [
        "Chợ hoa Quảng Bá lúc 2 giờ sáng",
        "Lò bánh mì đỏ lửa lúc 3 giờ sáng",
        "Gặp các bác xe ôm đêm",
        "Ly cà phê đầu tiên lúc 5h30",
      ],
      en: [
        "Quang Ba flower market at 2 AM",
        "Banh mi bakers at 3 AM",
        "Meet xe om night drivers",
        "First coffee at 5:30 AM",
      ],
    },
    included: {
      vi: [
        "Xe máy đưa đón xuyên đêm",
        "Người dẫn ca đêm",
        "Vé vào chợ hoa",
        "Bánh mì + cà phê",
      ],
      en: [
        "Midnight motorbike transport",
        "Night-shift guide",
        "Flower market access",
        "Banh mi + coffee",
      ],
    },
    schedule: {
      vi: [
        { time: "00:00", label: "Đón khách lúc nửa đêm" },
        { time: "00:30", label: "Phố cổ vắng tanh" },
        { time: "02:00", label: "Chợ hoa Quảng Bá" },
        { time: "03:30", label: "Lò bánh mì" },
        { time: "05:00", label: "Quán cà phê đầu ngày" },
      ],
      en: [
        { time: "00:00", label: "Midnight pickup" },
        { time: "00:30", label: "Empty Old Quarter" },
        { time: "02:00", label: "Flower market" },
        { time: "03:30", label: "Bakery visit" },
        { time: "05:00", label: "First cafe" },
      ],
    },
  },
};
