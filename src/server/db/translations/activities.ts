/**
 * Bilingual translations for the 12 activity entries in `activitySeeds`
 * (seed.ts). Source is English; Vietnamese brand-voice translation by
 * subagent T4.
 *
 * Consumed by:
 *   - seed.ts (writes both `_vi` / `_en` columns on insert)
 *   - scripts/backfill-bilingual-content.ts (UPDATE for prod rows by slug)
 */
export interface ActivityTranslation {
  title: { vi: string; en: string };
  subtitle: { vi: string; en: string };
  description: { vi: string; en: string };
  highlights: { vi: string[]; en: string[] };
  included: { vi: string[]; en: string[] };
  requirements: { vi: string[]; en: string[] };
}

export const ACTIVITY_TRANSLATIONS: Record<string, ActivityTranslation> = {
  "pho-making-class": {
    title: {
      vi: "Lớp học nấu phở",
      en: "Pho Making Class",
    },
    subtitle: {
      vi: "Ninh nước dùng, cán bánh phở, húp tô của chính mình",
      en: "Build the broth, roll the noodles, eat the bowl",
    },
    description: {
      vi: "Một buổi thực hành 2,5 tiếng trong căn bếp Hà Nội thật. Bạn sẽ học mẹo rút gọn nồi nước dùng 6 tiếng, quy tắc ba phần thịt bò, và vì sao nước mắm luôn cho sau cùng. Kết thúc bằng tô phở do chính tay bạn nấu.",
      en: "A hands-on 2.5-hour class in a real Hanoi kitchen. You'll learn the 6-hour broth shortcut, the three-meat beef rule, and why fish sauce goes in last. End with a bowl you made yourself.",
    },
    highlights: {
      vi: ["Bếp gia đình thật", "Mang về thẻ công thức", "Tô phở của chính bạn ở phút cuối"],
      en: ["Real family kitchen", "Take home recipe card", "Your own bowl at the end"],
    },
    included: {
      vi: ["Toàn bộ nguyên liệu", "Tạp dề", "Công thức in sẵn"],
      en: ["All ingredients", "Apron", "Printed recipe"],
    },
    requirements: {
      vi: ["Mặc đồ không sợ lấm bẩn"],
      en: ["Wear clothes you can get dirty"],
    },
  },

  "street-food-night-crawl": {
    title: {
      vi: "Lê la ẩm thực đêm Hà Nội",
      en: "Street Food Night Crawl",
    },
    subtitle: {
      vi: "5 điểm dừng, 2 tiếng, không một nhà hàng sang",
      en: "5 stops, 2 hours, zero fancy restaurants",
    },
    description: {
      vi: "Đúng lộ trình một người Hà Nội đi ăn tối thứ Sáu. Năm hàng ghế nhựa, mỗi chỗ một cốc bia hơi, không thực đơn tiếng Anh. Nam kể chuyện. Bạn ăn.",
      en: "The actual dinner route a Hanoian would walk on a Friday night. Five plastic-stool stalls, one glass of bia hoi per stop, zero menus in English. Nam narrates. You eat.",
    },
    highlights: {
      vi: ["5 hàng quán", "Bia hơi trong giá", "Không điểm khách du lịch"],
      en: ["5 food stops", "Bia hoi included", "No tourist stops"],
    },
    included: {
      vi: ["Toàn bộ phần nếm thử", "Bia hơi tại mỗi điểm", "Nước lọc"],
      en: ["All tastings", "Bia hoi at each stop", "Water"],
    },
    requirements: {
      vi: ["Bụng đói"],
      en: ["Empty stomach"],
    },
  },

  "train-street-photo-session": {
    title: {
      vi: "Buổi chụp ảnh phố đường tàu",
      en: "Train Street Photo Session",
    },
    subtitle: {
      vi: "Đoàn tàu nổi tiếng chạy ngang — an toàn — và mình bắt được khoảnh khắc ấy",
      en: "The famous train passes -- safely -- and we catch it",
    },
    description: {
      vi: "Phố đường tàu đã chắn rào từ năm 2023. Nam quen chủ quán cà phê, mình được vào trong. Giờ tàu chạy đã canh kỹ, cà phê trứng chuẩn vị, kèm 10 phút Nam dạy cấp tốc cách bù sáng để selfie giờ vàng cho ra ảnh.",
      en: "Access-gated since 2023. Nam has a contact at the cafe that lets us in. Timing-checked train passage, chef-quality egg coffee, and Nam's 10-minute crash course on exposure compensation for golden-hour selfies.",
    },
    highlights: {
      vi: ["Vào được phố đường tàu", "Cà phê trứng", "Hướng dẫn chụp ảnh"],
      en: ["Train Street entry", "Egg coffee", "Photo coaching"],
    },
    included: {
      vi: ["Phí vào quán", "Cà phê trứng"],
      en: ["Cafe entry", "Egg coffee"],
    },
    requirements: {
      vi: ["Điện thoại hoặc máy ảnh", "Giày kín mũi"],
      en: ["Smartphone or camera", "Closed shoes"],
    },
  },

  "bun-cha-craft-beer": {
    title: {
      vi: "Bún chả & bia thủ công",
      en: "Bun Cha & Craft Beer Pairing",
    },
    subtitle: {
      vi: "Món đặc trưng Hà Nội, năm dòng bia nội thử kèm",
      en: "Hanoi's signature dish, five local-brew flights",
    },
    description: {
      vi: "Bún chả thường ăn cùng nước chấm pha dưa góp. Nam ghép nó với năm dòng bia thủ công Việt Nam để bạn thấy khói than, mỡ thịt và vị hoa bia múa với nhau ra sao. Kết thúc bằng một chai mang về.",
      en: "Bun cha is usually eaten with pickle water. Nam pairs it with five Vietnamese craft beers to show how smoke, fat, and hop acid dance. Ends with a take-home bottle.",
    },
    highlights: {
      vi: ["Suất bún chả đầy đủ", "Năm dòng bia ghép vị", "Chai bia mang về"],
      en: ["Bun cha set", "5-flight beer pairing", "Take-home bottle"],
    },
    included: {
      vi: ["Bữa ăn đầy đủ", "5 cốc bia", "Chai bia mang về"],
      en: ["Full meal", "5 beers", "Take-home bottle"],
    },
    requirements: {
      vi: ["Từ 18 tuổi trở lên"],
      en: ["Age 18+"],
    },
  },

  "old-quarter-history-walk": {
    title: {
      vi: "Dạo lịch sử Phố cổ",
      en: "Old Quarter History Walk",
    },
    subtitle: {
      vi: "1000 năm trong 3 giờ — qua 36 phố phường",
      en: "1000 years in 3 hours -- through 36 streets",
    },
    description: {
      vi: "Linh dẫn bạn qua những phố hàng — Hàng Bạc, Hàng Đào, Hàng Giấy — và chỉ ra nghề nào đã sống qua một thiên niên kỷ. Kết thúc tại ngôi đền của 36 phố nghề, kèm một cuốn zine lịch sử in tay.",
      en: "Linh walks you through the guild streets -- silver, silk, paper -- and shows which trades survived a millennium. Ends at the Temple of the 36 Guilds with a printed history zine.",
    },
    highlights: {
      vi: ["8 phố nghề", "Những xưởng thủ công còn sót lại", "Zine in tay"],
      en: ["8 guild streets", "Surviving craft workshops", "Printed zine"],
    },
    included: {
      vi: ["Zine", "Nước lọc", "Phí vào đền"],
      en: ["Zine", "Water", "Temple entry"],
    },
    requirements: {
      vi: ["Đi bộ khoảng 3 km"],
      en: ["Walking ~3 km"],
    },
  },

  "hoa-lo-prison-deep-tour": {
    title: {
      vi: "Tour Hỏa Lò chuyên sâu",
      en: "Hoa Lo Prison Deep Tour",
    },
    subtitle: {
      vi: "Vượt khỏi audio guide — những câu chuyện khách du lịch không được nghe",
      en: "Beyond the audio guide -- the stories tourists miss",
    },
    description: {
      vi: "Audio guide chính thức rất lịch sự. Linh thì không. 90 phút trong Hỏa Lò với lịch sử thật về phòng hỏi cung thời Pháp thuộc, câu chuyện 'Hanoi Hilton' phía Mỹ, và cuộc vượt ngục suýt thành công.",
      en: "The regular audio guide stays polite. Linh doesn't. 90 minutes inside Hoa Lo with the actual history of French colonial interrogation, the American 'Hanoi Hilton' narrative, and the escape that almost worked.",
    },
    highlights: {
      vi: ["Bao gồm vé vào nhà tù", "Người dẫn am hiểu lịch sử", "Bảng niên đại in tay"],
      en: ["Prison entry included", "Historian-led", "Timeline handout"],
    },
    included: {
      vi: ["Vé vào", "Tài liệu phát tay"],
      en: ["Admission", "Handout"],
    },
    requirements: {
      vi: ["Từ 14 tuổi trở lên"],
      en: ["Minimum age 14"],
    },
  },

  "calligraphy-class": {
    title: {
      vi: "Lớp thư pháp Việt",
      en: "Vietnamese Calligraphy Class",
    },
    subtitle: {
      vi: "Bút lông, mực tàu, giấy dó — và tên bạn viết bằng chữ Hán",
      en: "Brush, ink, rice paper, your name in Han script",
    },
    description: {
      vi: "Một ông đồ dạy bạn viết tên mình bằng chữ Hán truyền thống trên giấy dó. Mang cuộn thư pháp về làm kỷ niệm. Linh phiên dịch và kể bối cảnh.",
      en: "A master calligrapher teaches you to write your name in traditional Han characters on rice paper. Take home your scroll. Linh translates and contextualises.",
    },
    highlights: {
      vi: ["Ông đồ thực thụ", "Cuộn thư pháp tên bạn", "Mang về làm kỷ niệm"],
      en: ["Master calligrapher", "Your name scroll", "Take home"],
    },
    included: {
      vi: ["Mực", "Giấy dó", "Bút lông", "Đóng khung"],
      en: ["Ink", "Paper", "Brush", "Framing"],
    },
    requirements: {
      vi: [],
      en: [],
    },
  },

  "water-puppet-theatre": {
    title: {
      vi: "Vé múa rối nước",
      en: "Water Puppet Theatre Tickets",
    },
    subtitle: {
      vi: "Loại hình nghệ thuật 1000 năm tuổi, kèm phần tóm tắt cốt truyện",
      en: "The 1000-year-old art form, with a storyline briefing",
    },
    description: {
      vi: "Ghế hạng nhất tại Nhà hát Múa rối Thăng Long. Linh kể trước cốt truyện cho bạn (không ai khác làm việc này), để bạn thật sự theo được mạch diễn. Trò chuyện văn hoá sau buổi diễn nếu bạn muốn.",
      en: "Premium seats at Thang Long Water Puppet Theatre. Linh briefs you on the storyline in advance (nobody else does this), so you actually follow the plot. Post-show cultural chat optional.",
    },
    highlights: {
      vi: ["Ghế hạng nhất", "Tóm tắt trước giờ diễn", "Tờ kịch bản"],
      en: ["Premium seats", "Pre-show briefing", "Story handout"],
    },
    included: {
      vi: ["Vé xem", "Phần tóm tắt cốt truyện"],
      en: ["Ticket", "Briefing"],
    },
    requirements: {
      vi: [],
      en: [],
    },
  },

  "egg-coffee-workshop": {
    title: {
      vi: "Workshop cà phê trứng",
      en: "Egg Coffee Workshop",
    },
    subtitle: {
      vi: "Tự tay đánh, học bí quyết của nhà Giảng",
      en: "Whip your own, learn the Giang family secret",
    },
    description: {
      vi: "Cà phê Giảng là nơi khai sinh ra cà phê trứng năm 1946. Châu có giấy mời cố định vào tận bếp sau. Đánh, rót, uống — và hiểu vì sao tỉ lệ lòng trắng với lòng đỏ là tất cả.",
      en: "Cafe Giang invented egg coffee in 1946. Chau has a standing invitation to the back kitchen. Whip, pour, drink -- and learn why the egg white to yolk ratio is everything.",
    },
    highlights: {
      vi: ["Cách pha của nhà Giảng", "Hai ly cà phê", "Thẻ công thức"],
      en: ["Giang family method", "Two drinks", "Recipe card"],
    },
    included: {
      vi: ["2 ly cà phê", "Thẻ công thức"],
      en: ["2 drinks", "Recipe card"],
    },
    requirements: {
      vi: [],
      en: [],
    },
  },

  "contemporary-art-tour": {
    title: {
      vi: "Tour gallery nghệ thuật đương đại",
      en: "Contemporary Art Gallery Tour",
    },
    subtitle: {
      vi: "3 phòng tranh, giới thiệu nghệ sĩ nếu họ đang ở Hà Nội",
      en: "3 galleries, introductions to artists when in town",
    },
    description: {
      vi: "Châu quen riêng hơn nửa số nghệ sĩ trong giới nghệ thuật đương đại Hà Nội. Ba phòng tranh trong 2,5 giờ, kết thúc ở một quán cà phê — nơi cô diễn giải lại những gì bạn vừa xem.",
      en: "Chau personally knows half the artists in Hanoi's contemporary scene. Three galleries in 2.5 hours, with a cafe debrief where she translates what you just saw.",
    },
    highlights: {
      vi: ["3 phòng tranh", "Giới thiệu với nghệ sĩ", "Trò chuyện ở quán cà phê"],
      en: ["3 galleries", "Artist introductions", "Cafe debrief"],
    },
    included: {
      vi: ["Phí vào phòng tranh", "Đồ uống ở quán cà phê"],
      en: ["Gallery entries", "Cafe drink"],
    },
    requirements: {
      vi: ["Đi bộ khoảng 2 km"],
      en: ["Walking ~2 km"],
    },
  },

  "tay-ho-lake-paddle": {
    title: {
      vi: "Chèo thuyền hoàng hôn hồ Tây",
      en: "Tay Ho Lake Sunset Paddle",
    },
    subtitle: {
      vi: "Chèo kayak hồ Tây vào giờ vàng",
      en: "Kayak West Lake at golden hour",
    },
    description: {
      vi: "Một buổi chèo kayak 90 phút lúc hoàng hôn trên hồ Tây. Châu chuẩn bị hộp đồ ăn vặt (bánh mì + trà đá). Nhớ mang máy ảnh theo — bóng chùa Trần Quốc soi xuống mặt hồ lúc 6h30 chiều chính là khung hình bạn cần.",
      en: "A 90-minute sunset kayak session on Tay Ho. Chau packs the snack box (banh mi + tra da). Bring your camera -- the Tran Quoc Pagoda reflection at 6:30 PM is the shot.",
    },
    highlights: {
      vi: ["Đúng giờ hoàng hôn", "Hộp đồ ăn vặt", "Bánh mì + trà đá"],
      en: ["Sunset timing", "Snack box", "Banh mi + tra da"],
    },
    included: {
      vi: ["Kayak", "Áo phao", "Hộp đồ ăn vặt"],
      en: ["Kayak", "Life vest", "Snack box"],
    },
    requirements: {
      vi: ["Biết bơi"],
      en: ["Able to swim"],
    },
  },

  "bat-trang-pottery": {
    title: {
      vi: "Vuốt gốm Bát Tràng",
      en: "Bat Trang Pottery Throwing",
    },
    subtitle: {
      vi: "Vuốt, nung, tráng men, mang về",
      en: "Make, fire, glaze, take home",
    },
    description: {
      vi: "Làng gốm 700 năm tuổi cách trung tâm 30 phút đi xe. Tự tay vuốt một chiếc bình trên bàn xoay truyền thống, nung, tráng men, và mang về. Đã bao gồm xe đưa đón và bữa trưa.",
      en: "700-year-old ceramic village 30 minutes out of town. Throw your own pot on a traditional wheel, fire it, glaze it, take it home. Transport + lunch included.",
    },
    highlights: {
      vi: ["Bàn xoay truyền thống", "Bình gốm mang về", "Bữa trưa"],
      en: ["Traditional wheel", "Take-home pot", "Lunch"],
    },
    included: {
      vi: ["Xe đưa đón", "Bữa trưa", "Hỗ trợ gửi hàng"],
      en: ["Transport", "Lunch", "Shipping help"],
    },
    requirements: {
      vi: ["Giày kín mũi"],
      en: ["Closed shoes"],
    },
  },
};
