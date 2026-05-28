/**
 * Bilingual translations for the 9 host-authored experiences seeded in
 * seed.ts. The English side mirrors the original seed text verbatim;
 * the Vietnamese side is a brand-voice translation (warm, observational,
 * occasionally poetic) by subagent T1.
 *
 * Consumed by:
 *   - seed.ts (writes both `_vi` / `_en` columns on insert)
 *   - scripts/backfill-bilingual-content.ts (UPDATE for prod rows)
 */
export interface HostExperienceTranslation {
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

export const HOST_EXPERIENCE_TRANSLATIONS: Record<string, HostExperienceTranslation> = {
  "hidden-alley-food-crawl": {
    title: {
      vi: "Lang thang ngõ nhỏ tìm vị Hà thành",
      en: "Hidden Alley Food Crawl",
    },
    subtitle: {
      vi: "Ăn xuyên qua những ngách phố cổ ít người biết",
      en: "Eat your way through the Old Quarter's back lanes",
    },
    description: {
      vi: "Sáu điểm dừng, không một cái bẫy du khách nào. Tôi sẽ dẫn bạn len lỏi qua những con ngõ chỉ người Hà Nội mới tỏ — nơi có bún chả, phở, bánh mì, cà phê trứng và chè ngon nhất phố. Hãy đến với cái bụng đói — bạn sẽ ăn như một người Hà thành bốn đời.",
      en: "Six stops, zero tourist traps. I'll take you through the alleys only locals know for the best bun cha, pho, banh mi, egg coffee, and che sweet soup. Come hungry -- you'll eat like a Hanoian for four generations.",
    },
    highlights: {
      vi: [
        "6 quán ăn dân bản địa giữ riêng cho mình",
        "Lối đi qua những ngõ khuất",
        "Cà phê trứng ngon nhất Hà Nội",
        "Mẹo của người Hà Nội cho từng miếng ăn",
      ],
      en: [
        "6 food stops locals keep to themselves",
        "Hidden alley navigation",
        "Best egg coffee in Hanoi",
        "Real-time local tips on every bite",
      ],
    },
    included: {
      vi: [
        "Trọn 6 phần nếm thử",
        "Nước suối đóng chai",
        "Mẹo chụp ảnh ẩm thực",
        "Thẻ công thức mang về",
      ],
      en: [
        "All 6 tastings",
        "Bottled water",
        "Photography tips",
        "Recipe card",
      ],
    },
    schedule: {
      vi: [
        { time: "10:00", label: "Hẹn gặp ở góc phố Hàng Bông" },
        { time: "10:15", label: "Điểm 1: Bún chả Hương Liên" },
        { time: "11:00", label: "Điểm 2: Phở Gia Truyền Bát Đàn" },
        { time: "11:45", label: "Điểm 3: Bánh mì 25" },
        { time: "12:15", label: "Điểm 4: Cà phê trứng Giảng" },
        { time: "12:45", label: "Điểm 5: Hàng chè vỉa hè" },
        { time: "13:00", label: "Chia tay" },
      ],
      en: [
        { time: "10:00", label: "Meet at Hang Bong corner" },
        { time: "10:15", label: "Stop 1: Bun Cha Huong Lien" },
        { time: "11:00", label: "Stop 2: Pho Gia Truyen Bat Dan" },
        { time: "11:45", label: "Stop 3: Banh Mi 25" },
        { time: "12:15", label: "Stop 4: Giang Egg Coffee" },
        { time: "12:45", label: "Stop 5: Che stand" },
        { time: "13:00", label: "Farewell" },
      ],
    },
  },

  "motorbike-night-photo-tour": {
    title: {
      vi: "Đêm Hà Nội qua ống kính sau xe máy",
      en: "Motorbike Night Photo Tour",
    },
    subtitle: {
      vi: "Ngồi sau xe máy, ngắm Hà Nội đổi màu khi đêm xuống",
      en: "Ride pillion through Hanoi's after-dark colors",
    },
    description: {
      vi: "Ngồi sau xe máy của tôi, ta lướt qua bốn điểm rực rỡ ánh đèn neon — Phố tàu hỏa, cầu Long Biên trong đêm, những ngõ nhỏ Phố cổ và chợ hoa Quảng Bá. Tour dành riêng cho các nhà sáng tạo nội dung và nhiếp ảnh đêm muốn bỏ qua hàng dài chờ Grab.",
      en: "Ride on the back of my motorbike as we hit four neon-lit spots across the city -- Train Street, Long Bien Bridge at night, the Old Quarter alleys, and Quang Ba flower market. Perfect for content creators and night photographers who want to skip the Grab queues.",
    },
    highlights: {
      vi: [
        "Chuyến xe máy có đủ đồ bảo hộ",
        "4 điểm chụp trong một đêm",
        "Canh giờ ra vào Phố tàu hỏa",
        "Vào chợ hoa lúc 2 giờ sáng",
      ],
      en: [
        "Motorbike ride with gear",
        "4 photo spots in 1 night",
        "Train Street access timing",
        "Flower market 2 AM access",
      ],
    },
    included: {
      vi: [
        "Xe máy + mũ bảo hiểm",
        "Áo mưa khi cần",
        "Hướng dẫn chụp ảnh",
        "Một ly trà nóng giữa đường",
      ],
      en: [
        "Motorbike + helmet",
        "Rain poncho if needed",
        "Photography coaching",
        "Hot tea mid-ride",
      ],
    },
    schedule: {
      vi: [
        { time: "21:00", label: "Hẹn gặp ở Hồ Hoàn Kiếm" },
        { time: "21:30", label: "Phố tàu hỏa" },
        { time: "22:30", label: "Cầu Long Biên" },
        { time: "23:30", label: "Ngõ nhỏ Phố cổ" },
        { time: "01:00", label: "Chợ hoa Quảng Bá" },
      ],
      en: [
        { time: "21:00", label: "Meet at Hoan Kiem Lake" },
        { time: "21:30", label: "Train Street" },
        { time: "22:30", label: "Long Bien Bridge" },
        { time: "23:30", label: "Old Quarter alleys" },
        { time: "01:00", label: "Quang Ba flower market" },
      ],
    },
  },

  "breakfast-pho-pilgrimage": {
    title: {
      vi: "Hành hương phở sớm mai",
      en: "Breakfast Pho Pilgrimage",
    },
    subtitle: {
      vi: "Ba bát phở, ba gia đình, một buổi sớm",
      en: "Three bowls, three families, one morning",
    },
    description: {
      vi: "Hà Nội không có một bát phở 'ngon nhất' — chỉ có hàng trăm bát phở hoàn hảo, mỗi bát được khu phố của mình bảo vệ đến cùng. Sáu giờ sáng, khi nước dùng còn đậm nhất, ta thử ba bát — và tôi sẽ kể vì sao họ chẳng đồng ý nhau về bất cứ điều gì.",
      en: "Hanoi has no single best pho -- it has hundreds of perfect bowls, each defended to the death by its neighborhood. We'll try three at 6 AM when the broth is freshest, and I'll explain why they disagree about absolutely everything.",
    },
    highlights: {
      vi: [
        "3 bát phở trong 2 giờ",
        "Bình minh giữa Phố cổ",
        "Gặp gỡ những người nấu phở",
        "Bạn chấm bát ngon nhất",
      ],
      en: [
        "3 pho bowls in 2 hours",
        "Dawn in the Old Quarter",
        "Meet the cooks",
        "You vote the winner",
      ],
    },
    included: {
      vi: [
        "Trọn 3 bát phở",
        "Một ly cà phê sữa đá",
        "Mẹo boa tiền theo lối Hà thành",
      ],
      en: [
        "All 3 pho bowls",
        "Ca phe sua da coffee",
        "Local tipping etiquette",
      ],
    },
    schedule: {
      vi: [
        { time: "06:00", label: "Hẹn gặp ở Hàng Gai" },
        { time: "06:10", label: "Phở #1: Gia Truyền Bát Đàn" },
        { time: "06:50", label: "Phở #2: gánh phở gia đình vỉa hè" },
        { time: "07:30", label: "Phở #3: quán hiện đại được ưa chuộng" },
        { time: "08:00", label: "Cà phê & chuyện trò sau hành trình" },
      ],
      en: [
        { time: "06:00", label: "Meet at Hang Gai" },
        { time: "06:10", label: "Pho #1: Gia Truyen Bat Dan" },
        { time: "06:50", label: "Pho #2: family street stall" },
        { time: "07:30", label: "Pho #3: modern favorite" },
        { time: "08:00", label: "Coffee + debrief" },
      ],
    },
  },

  "colonial-hanoi-walking-tour": {
    title: {
      vi: "Hà Nội thời thuộc địa qua từng bước chân",
      en: "Colonial Hanoi Walking Tour",
    },
    subtitle: {
      vi: "Khu phố Pháp dưới ánh nhìn của nhà sử học",
      en: "The French Quarter through a historian's lens",
    },
    description: {
      vi: "Khu phố Pháp Hà Nội là một kho lưu trữ sống: Nhà hát Lớn, những toà báo xưa, Nhà thờ Lớn, Hoả Lò. Tôi sẽ dẫn bạn qua lớp ký ức thuộc địa mà ai cũng nhìn thấy nhưng chẳng mấy ai kể lại.",
      en: "Hanoi's French Quarter is a living archive: the Opera House, the old press buildings, St. Joseph's Cathedral, Hoa Lo Prison. I'll walk you through the colonial layer that everyone sees but nobody explains.",
    },
    highlights: {
      vi: [
        "5 công trình thời thuộc địa",
        "Kể chuyện dưới góc nhìn sử học",
        "Vé vào Nhà tù Hoả Lò",
        "Một quán cà phê từ thời Pháp",
      ],
      en: [
        "5 colonial-era buildings",
        "Historian-guided narrative",
        "Hoa Lo Prison entry",
        "French-era cafe stop",
      ],
    },
    included: {
      vi: [
        "Vé Nhà tù Hoả Lò",
        "Một chặng cà phê",
        "Tờ niên biểu in sẵn",
      ],
      en: [
        "Hoa Lo Prison ticket",
        "Cafe stop",
        "Printed timeline handout",
      ],
    },
    schedule: {
      vi: [
        { time: "09:00", label: "Hẹn gặp ở Nhà hát Lớn" },
        { time: "09:20", label: "Dạo bộ qua phố báo chí xưa" },
        { time: "10:10", label: "Nhà thờ Lớn" },
        { time: "11:00", label: "Nhà tù Hoả Lò" },
        { time: "12:00", label: "Trò chuyện bên ly cà phê" },
      ],
      en: [
        { time: "09:00", label: "Meet at Opera House" },
        { time: "09:20", label: "Press Quarter walk" },
        { time: "10:10", label: "St. Joseph's Cathedral" },
        { time: "11:00", label: "Hoa Lo Prison" },
        { time: "12:00", label: "Cafe debrief" },
      ],
    },
  },

  "thousand-year-stories-old-quarter": {
    title: {
      vi: "Ngàn năm chuyện kể Phố cổ",
      en: "1000-Year Stories of the Old Quarter",
    },
    subtitle: {
      vi: "Ba mươi sáu phố phường, mỗi tên một nghề xưa",
      en: "The 36 streets, each named for what it sold",
    },
    description: {
      vi: "Mỗi con phố trong khu Phố cổ từng là một phường nghề — bạc, vải, nước mắm, giấy. Hàng hoá đã đổi, mà tên gọi vẫn còn nguyên. Tôi sẽ dẫn bạn qua tám phố trong số đó, và chỉ cho bạn thấy những nghề nào vẫn còn sống sau ngàn năm.",
      en: "Every street in the Old Quarter used to be a guild -- silver, cotton, fish sauce, paper. The names stuck even when the goods didn't. I'll walk you through 8 of them and show you which trades still survive a thousand years later.",
    },
    highlights: {
      vi: [
        "8 phố nghề xưa",
        "Những xưởng thợ còn lưu giữ",
        "Đình của 36 phường nghề",
        "Nguồn gốc tên phố",
      ],
      en: [
        "8 guild streets",
        "Surviving craft workshops",
        "Temple of the 36 guilds",
        "Street-name etymology",
      ],
    },
    included: {
      vi: [
        "Ghé thăm xưởng nghề thủ công",
        "Phí vào đền",
        "Một chén trà truyền thống",
      ],
      en: [
        "Craft workshop visit",
        "Temple entry fees",
        "Traditional tea break",
      ],
    },
    schedule: {
      vi: [
        { time: "09:00", label: "Hẹn gặp ở Chợ Đồng Xuân" },
        { time: "09:20", label: "Hàng Bạc (phố nghề bạc)" },
        { time: "10:00", label: "Hàng Mã (phố nghề giấy)" },
        { time: "10:40", label: "Hàng Gai (phố nghề tơ lụa)" },
        { time: "11:30", label: "Đền Bạch Mã" },
        { time: "12:00", label: "Chén trà chia tay" },
      ],
      en: [
        { time: "09:00", label: "Meet at Dong Xuan Market" },
        { time: "09:20", label: "Hang Bac (silver street)" },
        { time: "10:00", label: "Hang Ma (paper street)" },
        { time: "10:40", label: "Hang Gai (silk street)" },
        { time: "11:30", label: "Bach Ma Temple" },
        { time: "12:00", label: "Farewell tea" },
      ],
    },
  },

  "french-quarter-train-street": {
    title: {
      vi: "Khu phố Pháp & Phố tàu hỏa",
      en: "French Quarter + Train Street",
    },
    subtitle: {
      vi: "Kiến trúc thuộc địa gặp gỡ huyên náo Phố tàu hỏa",
      en: "Colonial architecture meets the chaos of Train Street",
    },
    description: {
      vi: "Hai khoảnh khắc đối lập của Hà Nội trong cùng một buổi chiều: nét thanh nhã trầm tĩnh của khu phố Pháp, rồi cơn náo loạn có kiểm soát ở Phố tàu hỏa — nơi chuyến tàu hai lần mỗi ngày lướt sát những hàng cà phê chỉ vài phân. Hợp với những ai thích đọc lịch sử qua các lát cắt tương phản.",
      en: "Two contrasting Hanoi moments in one afternoon: the quiet elegance of the French Quarter, then the controlled chaos of Train Street where the twice-daily train clears cafes by inches. Best done by people who like their history in contrasts.",
    },
    highlights: {
      vi: [
        "Dạo bộ khu phố Pháp",
        "Lối vào Phố tàu hỏa",
        "Hướng dẫn canh giờ tàu an toàn",
        "Cà phê bên đường ray",
      ],
      en: [
        "French Quarter walk",
        "Train Street access",
        "Safe train-timing coaching",
        "Trackside coffee",
      ],
    },
    included: {
      vi: [
        "Phí quán cà phê Phố tàu hỏa",
        "Hướng dẫn giờ giấc & an toàn",
      ],
      en: [
        "Train Street cafe fee",
        "Timing / safety briefing",
      ],
    },
    schedule: {
      vi: [
        { time: "15:00", label: "Nhà hát Lớn" },
        { time: "15:30", label: "Dạo bộ khu phố Pháp" },
        { time: "16:15", label: "Quán cà phê Phố tàu hỏa" },
        { time: "17:00", label: "Tàu đi ngang qua (nếu đúng lịch)" },
        { time: "17:30", label: "Chia tay" },
      ],
      en: [
        { time: "15:00", label: "Opera House" },
        { time: "15:30", label: "French Quarter walk" },
        { time: "16:15", label: "Train Street cafe" },
        { time: "17:00", label: "Train passes (if scheduled)" },
        { time: "17:30", label: "Farewell" },
      ],
    },
  },

  "specialty-coffee-crawl": {
    title: {
      vi: "Ngao du qua bốn quán cà phê đặc sản",
      en: "Specialty Coffee Crawl",
    },
    subtitle: {
      vi: "Bốn quán rang, bốn không khí, hai tiếng rưỡi",
      en: "Four roasters, four vibes, two and a half hours",
    },
    description: {
      vi: "Việt Nam là nước xuất khẩu cà phê lớn thứ nhì thế giới, nhưng làn sóng cà phê đặc sản ở Hà Nội mới nổi lên gần đây. Bốn quán rang đang lên: một bar pour-over học nghề từ Nhật, một quán cà phê trứng nguyên bản, một thương hiệu Sài Gòn ra Bắc, và một rooftop kín đáo. Tôi quen từng barista.",
      en: "Vietnam is the world's #2 coffee producer but Hanoi's specialty scene only caught up recently. Four roasters on the rise: a Japanese-trained pour-over bar, an egg-coffee original, a Saigon transplant, and a hidden rooftop. I know the baristas.",
    },
    highlights: {
      vi: [
        "4 quán rang xay",
        "Gặp gỡ các barista",
        "Lịch sử cà phê Việt",
        "Cà phê hạt mang về",
      ],
      en: [
        "4 roasters",
        "Meet the baristas",
        "Vietnamese coffee history",
        "Take-home beans",
      ],
    },
    included: {
      vi: [
        "Trọn 4 ly đồ uống",
        "100g cà phê đặc sản",
        "Cuốn cẩm nang in sẵn",
      ],
      en: [
        "All 4 drinks",
        "100g of specialty beans",
        "Written guide",
      ],
    },
    schedule: {
      vi: [
        { time: "10:00", label: "Hidden Gem Coffee" },
        { time: "10:45", label: "Cà phê Giảng (cái nôi cà phê trứng)" },
        { time: "11:30", label: "The Workshop" },
        { time: "12:15", label: "Rooftop Roastery" },
        { time: "12:30", label: "Nếm thử hạt & chia tay" },
      ],
      en: [
        { time: "10:00", label: "Hidden Gem Coffee" },
        { time: "10:45", label: "Giang Cafe (egg coffee original)" },
        { time: "11:30", label: "The Workshop" },
        { time: "12:15", label: "Rooftop Roastery" },
        { time: "12:30", label: "Bean tasting + farewell" },
      ],
    },
  },

  "art-gallery-hop": {
    title: {
      vi: "Lướt qua bốn gallery nghệ thuật",
      en: "Art Gallery Hop",
    },
    subtitle: {
      vi: "Bốn gallery, nghệ thuật đương đại Việt, một cuốn zine in tay",
      en: "Four galleries, contemporary Vietnamese art, one printed zine",
    },
    description: {
      vi: "Làng nghệ thuật đương đại Hà Nội — lặng lẽ mà sôi động bậc nhất Đông Nam Á. Ta ghé bốn gallery với hội hoạ, điêu khắc và media mới, và tôi sẽ giới thiệu bạn với những nghệ sĩ tôi quen riêng. Bạn ra về cùng một cuốn zine in tay về nghệ thuật Việt.",
      en: "Hanoi's contemporary art scene is quietly one of the most alive in Southeast Asia. We'll visit four galleries showing painting, sculpture, and new media, and I'll introduce you to the artists I know personally. You'll leave with a printed zine of Vietnamese art commentary.",
    },
    highlights: {
      vi: [
        "4 gallery nghệ thuật",
        "Gặp gỡ nghệ sĩ khi họ ở Hà Nội",
        "Tặng kèm cuốn zine",
        "Trò chuyện với một giám tuyển",
      ],
      en: [
        "4 galleries",
        "Artist introductions when in town",
        "Zine included",
        "Meet a curator",
      ],
    },
    included: {
      vi: [
        "Vé vào các gallery",
        "Cuốn zine in sẵn",
        "Trà nghỉ tại quán cà phê của nghệ sĩ",
      ],
      en: [
        "Gallery entries",
        "Printed zine",
        "Tea break at artist cafe",
      ],
    },
    schedule: {
      vi: [
        { time: "14:00", label: "Manzi Art Space" },
        { time: "14:45", label: "Nhà Sàn Collective" },
        { time: "15:30", label: "Work Room Four" },
        { time: "16:15", label: "VCCA Hà Nội" },
        { time: "17:00", label: "Chén trà chia tay" },
      ],
      en: [
        { time: "14:00", label: "Manzi Art Space" },
        { time: "14:45", label: "Nha San Collective" },
        { time: "15:30", label: "Work Room Four" },
        { time: "16:15", label: "VCCA Hanoi" },
        { time: "17:00", label: "Farewell tea" },
      ],
    },
  },

  "bat-trang-ceramic-village": {
    title: {
      vi: "Một ngày ở làng gốm Bát Tràng",
      en: "Bat Trang Ceramic Village Day Trip",
    },
    subtitle: {
      vi: "Tự tay nặn, nung, rồi mang về",
      en: "Throw a pot, fire it, take it home",
    },
    description: {
      vi: "Cách trung tâm 13 km, Bát Tràng đã làm gốm suốt bảy trăm năm. Bạn dành trọn một ngày bên một nghệ nhân đời thứ tư: tự tay xoay phôi trên bàn gốm, nung, tráng men và mang tác phẩm của mình về. Đã bao gồm xe đưa đón, bữa trưa, và hỗ trợ gửi hàng nếu nó không vừa hành lý xách tay.",
      en: "13 km outside the city, Bat Trang has been making ceramics for 700 years. Spend a day with a fourth-generation ceramicist: throw your own pot on the wheel, fire it, glaze it, and take it home. Includes transport, lunch, and shipping help if it doesn't fit in your carry-on.",
    },
    highlights: {
      vi: [
        "Tự xoay phôi gốm",
        "Tự nung và tráng men",
        "Mang sản phẩm về nhà",
        "Bữa trưa cùng gia đình nghệ nhân",
      ],
      en: [
        "Throw your own pot",
        "Fire and glaze it",
        "Take it home",
        "Lunch with ceramicist family",
      ],
    },
    included: {
      vi: [
        "Xe đưa đón hai chiều",
        "Toàn bộ nguyên liệu làm gốm",
        "Bữa trưa",
        "Hỗ trợ thủ tục gửi hàng",
      ],
      en: [
        "Round-trip transport",
        "All ceramic supplies",
        "Lunch",
        "Shipping coordination",
      ],
    },
    schedule: {
      vi: [
        { time: "09:00", label: "Đón khách tại Phố cổ" },
        { time: "09:30", label: "Đến Bát Tràng" },
        { time: "10:00", label: "Buổi xoay bàn gốm" },
        { time: "12:00", label: "Bữa trưa" },
        { time: "13:00", label: "Tráng men" },
        { time: "14:00", label: "Trở về thành phố" },
      ],
      en: [
        { time: "09:00", label: "Pickup Old Quarter" },
        { time: "09:30", label: "Arrive Bat Trang" },
        { time: "10:00", label: "Wheel session" },
        { time: "12:00", label: "Lunch" },
        { time: "13:00", label: "Glazing" },
        { time: "14:00", label: "Return to city" },
      ],
    },
  },
};
