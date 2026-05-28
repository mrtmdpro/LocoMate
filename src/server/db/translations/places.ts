/**
 * Bilingual translations for the curated HANOI_PLACES entries in seed.ts.
 * Most source `name` fields mix English context with Vietnamese proper
 * nouns ("Bun Cha Huong Lien", "Pho Thin"). The vi side restores correct
 * diacritics and Vietnamese phrasing; the en side keeps a clean English
 * label that still preserves the Vietnamese food/place name.
 *
 * Consumed by:
 *   - seed.ts (writes both `_vi` / `_en` columns on insert)
 *   - scripts/backfill-bilingual-content.ts (UPDATE for prod rows by slug)
 */
export interface PlaceTranslation {
  name: { vi: string; en: string };
  description: { vi: string; en: string };
}

export const PLACE_TRANSLATIONS: Record<string, PlaceTranslation> = {
  // ===== CAFE =====
  "egg-coffee-at-giang-cafe": {
    name: {
      vi: "Cà phê trứng Giảng",
      en: "Egg Coffee at Giang Cafe",
    },
    description: {
      vi: "Cà phê trứng nguyên bản từ năm 1946. Quán nhỏ nép trong con ngõ, có ly cà phê trứng béo, ngậy bậc nhất Hà Nội.",
      en: "The original egg coffee since 1946. A tiny alley cafe with the richest, creamiest ca phe trung in the city.",
    },
  },

  "loading-t-cafe": {
    name: {
      vi: "Loading T Cafe",
      en: "Loading T Cafe",
    },
    description: {
      vi: "Quán cà phê sân thượng sành điệu nhìn ra Hồ Hoàn Kiếm, nội thất cực hợp lên hình Instagram.",
      en: "Trendy rooftop cafe overlooking Hoan Kiem Lake with Instagrammable interiors.",
    },
  },

  "cong-caphe": {
    name: {
      vi: "Cộng Cà phê",
      en: "Cong Caphe",
    },
    description: {
      vi: "Chuỗi cà phê phong cách bộ đội với cà phê dừa Việt Nam, võng đu đưa và đồ trang trí vintage.",
      en: "Military-themed cafe chain with Vietnamese coconut coffee, hammocks, and vintage decor.",
    },
  },

  "train-street-coffee": {
    name: {
      vi: "Cà phê Đường Tàu",
      en: "Train Street Coffee",
    },
    description: {
      vi: "Ngồi cách đường ray vài gang tay, nhâm nhi cà phê khi đoàn tàu rầm rập đi qua. Hồi hộp và đậm chất không khí.",
      en: "Sit inches from the railway tracks and sip coffee as the train passes. Pure adrenaline and atmosphere.",
    },
  },

  "the-note-coffee": {
    name: {
      vi: "The Note Coffee",
      en: "The Note Coffee",
    },
    description: {
      vi: "Bốn bức tường phủ kín những mẩu giấy nhớ của du khách khắp thế giới. View phố cổ tuyệt vời.",
      en: "Walls covered with sticky notes from travelers worldwide. Great views of the Old Quarter streets.",
    },
  },

  "hidden-alley-cafe-56": {
    name: {
      vi: "Quán cà phê ngõ giấu kín 56",
      en: "Hidden Alley Cafe 56",
    },
    description: {
      vi: "Quán cà phê bí mật nép sau một cánh cửa ngõ hẹp giữa lòng phố cổ. Cứ tìm tấm biển xanh bạc màu là thấy.",
      en: "A secret cafe tucked behind a narrow alley door in the Old Quarter. Find it by the faded blue sign.",
    },
  },

  "hanoi-social-club": {
    name: {
      vi: "Hanoi Social Club",
      en: "Hanoi Social Club",
    },
    description: {
      vi: "Quán cà phê kiêm không gian co-working sáng tạo, có nhạc sống, triển lãm nghệ thuật và bữa brunch lành mạnh.",
      en: "Creative co-working cafe with live music, art exhibitions, and healthy brunch options.",
    },
  },

  "blackbird-coffee": {
    name: {
      vi: "Blackbird Coffee",
      en: "Blackbird Coffee",
    },
    description: {
      vi: "Cà phê đặc sản làn sóng thứ ba với từng ly pour-over được pha tỉ mỉ và hạt single-origin.",
      en: "Third-wave specialty coffee with meticulous pour-overs and single-origin beans.",
    },
  },

  // ===== RESTAURANT / STREET FOOD =====
  "bun-cha-huong-lien-obama-bun-cha": {
    name: {
      vi: "Bún chả Hương Liên (Bún chả Obama)",
      en: "Bun Cha Huong Lien (Obama Bun Cha)",
    },
    description: {
      vi: "Đúng nơi Anthony Bourdain và Tổng thống Obama cùng ăn bún chả. Vẫn 2 đô cho suất ngon nhất phố.",
      en: "The exact spot where Anthony Bourdain and President Obama shared bun cha. Still $2 for the best in town.",
    },
  },

  "pho-thin": {
    name: {
      vi: "Phở Thìn",
      en: "Pho Thin",
    },
    description: {
      vi: "Quán phở bò huyền thoại từ năm 1979. Nước dùng được áp chảo cùng mỡ bò, độ đậm đà khó quên.",
      en: "Legendary pho bo since 1979. The broth is seared with beef fat for an unforgettable depth of flavor.",
    },
  },

  "banh-mi-25": {
    name: {
      vi: "Bánh mì 25",
      en: "Banh Mi 25",
    },
    description: {
      vi: "Liên tục được xếp vào hàng bánh mì ngon nhất thế giới. Vỏ bánh giòn rụm, pate đậm vị, rau thơm và ớt cay.",
      en: "Consistently ranked among the world's best banh mi. Crusty baguette, pate, herbs, and chili.",
    },
  },

  "cha-ca-la-vong": {
    name: {
      vi: "Chả cá Lã Vọng",
      en: "Cha Ca La Vong",
    },
    description: {
      vi: "Nhà hàng một-món nổi tiếng nhất Hà Nội, mở từ năm 1871. Cá ướp nghệ xèo nóng ngay tại bàn cùng thì là và rau thơm.",
      en: "Hanoi's most famous single-dish restaurant since 1871. Turmeric fish sizzled tableside with dill and herbs.",
    },
  },

  "bun-dau-mam-tom-alley": {
    name: {
      vi: "Ngõ bún đậu mắm tôm",
      en: "Bun Dau Mam Tom Alley",
    },
    description: {
      vi: "Hàng đậu phụ chấm mắm tôm trong ngõ nhỏ ven đường. Trải nghiệm mùi-vị Hà Nội đúng chất.",
      en: "Street-side tofu and shrimp paste stall in a narrow alley. The authentic Hanoi smell-and-taste experience.",
    },
  },

  "xoi-yen": {
    name: {
      vi: "Xôi Yến",
      en: "Xoi Yen",
    },
    description: {
      vi: "Xôi với đủ loại topping từ pate đến hành phi. Một địa chỉ ăn sáng huyền thoại của dân phố cổ.",
      en: "Sticky rice with toppings from pate to fried onion. A local breakfast institution in the Old Quarter.",
    },
  },

  "nem-ran-hang-bo": {
    name: {
      vi: "Nem rán Hàng Bồ",
      en: "Nem Ran Hang Bo",
    },
    description: {
      vi: "Nem rán giòn rụm phục vụ trên những chiếc ghế nhựa ở góc phố. Vàng ươm, giòn tan và gây nghiện.",
      en: "Deep-fried spring rolls served at a plastic-stool corner stall. Crispy, golden, and addictive.",
    },
  },

  "quan-an-ngon": {
    name: {
      vi: "Quán Ăn Ngon",
      en: "Quan An Ngon",
    },
    description: {
      vi: "Nhà hàng sân vườn sang trọng tái hiện những món ăn đường phố Hà Nội ngon nhất dưới một mái nhà. Hợp với người lần đầu thử ẩm thực vỉa hè.",
      en: "Elegant courtyard restaurant recreating the best Hanoi street food under one roof. Great for nervous first-timers.",
    },
  },

  "pho-gia-truyen-bat-dan": {
    name: {
      vi: "Phở Gia Truyền Bát Đàn",
      en: "Pho Gia Truyen Bat Dan",
    },
    description: {
      vi: "Xếp hàng cùng người dân từ 6 giờ sáng để thưởng thức tô phở gây tranh cãi nhất Hà Nội. Chỉ nhận tiền mặt.",
      en: "Queue up with the locals at 6AM for the most argued-about bowl of pho in Hanoi. Cash only.",
    },
  },

  "com-suon-tong-duy-tan": {
    name: {
      vi: "Cơm sườn Tống Duy Tân",
      en: "Com Suon Tong Duy Tan",
    },
    description: {
      vi: "Suất cơm tấm sườn ngon nhất Hà Nội. Bữa trưa hoàn hảo chỉ 1,5 đô giữa lòng nhân viên văn phòng.",
      en: "Best broken rice with pork chop in Hanoi. A perfect $1.50 lunch among office workers.",
    },
  },

  // ===== CULTURAL =====
  "temple-of-literature": {
    name: {
      vi: "Văn Miếu - Quốc Tử Giám",
      en: "Temple of Literature",
    },
    description: {
      vi: "Trường đại học đầu tiên của Việt Nam, dựng từ năm 1070. Sân vườn tĩnh lặng, bia tiến sĩ trên lưng rùa và 1000 năm truyền thống khoa cử.",
      en: "Vietnam's first university, founded in 1070. Serene courtyards, turtle steles, and 1000 years of scholarly history.",
    },
  },

  "ho-chi-minh-mausoleum": {
    name: {
      vi: "Lăng Chủ tịch Hồ Chí Minh",
      en: "Ho Chi Minh Mausoleum",
    },
    description: {
      vi: "Thi hài Bác Hồ được bảo quản trong lăng đá hoa cương trang nghiêm. Một điểm hành hương đầy thiêng liêng.",
      en: "The preserved body of Ho Chi Minh in a grand marble mausoleum. A solemn pilgrimage site.",
    },
  },

  "hoan-kiem-lake-ngoc-son-temple": {
    name: {
      vi: "Hồ Hoàn Kiếm & Đền Ngọc Sơn",
      en: "Hoan Kiem Lake & Ngoc Son Temple",
    },
    description: {
      vi: "Trái tim của Hà Nội. Bước qua cầu Thê Húc đỏ son sang đền trên đảo, rồi thong thả dạo quanh hồ lúc hoàng hôn.",
      en: "The heart of Hanoi. Walk the red Huc Bridge to the island temple, then circle the lake at sunset.",
    },
  },

  "old-quarter-36-streets-walk": {
    name: {
      vi: "Dạo bộ 36 phố phường",
      en: "Old Quarter 36 Streets Walk",
    },
    description: {
      vi: "Mỗi con phố mang tên mặt hàng từng được bày bán: Hàng Bạc, Hàng Lụa, Hàng Giấy, Hàng Thiếc. Hãy thử lạc đường có chủ đích.",
      en: "Each street named after the goods once sold there. Silver, silk, paper, tin. Get lost on purpose.",
    },
  },

  "hanoi-opera-house": {
    name: {
      vi: "Nhà hát Lớn Hà Nội",
      en: "Hanoi Opera House",
    },
    description: {
      vi: "Nhà hát opera kiến trúc Pháp lộng lẫy, xây năm 1911. Xem một suất múa rối nước hoặc đơn giản chỉ ngắm mặt tiền về đêm.",
      en: "A stunning French colonial opera house built in 1911. Attend a water puppet show or just admire the facade at night.",
    },
  },

  "thang-long-water-puppet-theatre": {
    name: {
      vi: "Nhà hát Múa rối nước Thăng Long",
      en: "Thang Long Water Puppet Theatre",
    },
    description: {
      vi: "Nghệ thuật múa rối nước truyền thống cùng dàn nhạc sống. Loại hình nghệ thuật độc đáo có lịch sử 1000 năm, nhất định phải xem.",
      en: "Traditional Vietnamese water puppetry with live orchestra. A must-see unique art form dating back 1000 years.",
    },
  },

  "bach-ma-temple": {
    name: {
      vi: "Đền Bạch Mã",
      en: "Bach Ma Temple",
    },
    description: {
      vi: "Ngôi đền cổ nhất phố cổ, trấn giữ cửa Đông kinh thành Thăng Long từ năm 1010.",
      en: "The oldest temple in the Old Quarter, guarding the eastern gate of ancient Thang Long citadel since 1010 AD.",
    },
  },

  "tran-quoc-pagoda": {
    name: {
      vi: "Chùa Trấn Quốc",
      en: "Tran Quoc Pagoda",
    },
    description: {
      vi: "Ngôi chùa Phật giáo cổ nhất Hà Nội, dựng từ thế kỷ VI trên một bán đảo nhỏ giữa Hồ Tây. Hoàng hôn đẹp ngoạn mục.",
      en: "The oldest Buddhist temple in Hanoi, built in the 6th century on an island in West Lake. Spectacular at sunset.",
    },
  },

  "hoa-lo-prison-museum": {
    name: {
      vi: "Bảo tàng Nhà tù Hỏa Lò",
      en: "Hoa Lo Prison Museum",
    },
    description: {
      vi: "Nhà tù 'Hilton Hà Nội' khét tiếng, nơi từng giam tù binh Mỹ. Đầy ám ảnh, mang tính giáo dục và xúc động một cách bất ngờ.",
      en: "The infamous 'Hanoi Hilton' where American POWs were held. Haunting, educational, and surprisingly moving.",
    },
  },

  "imperial-citadel-of-thang-long": {
    name: {
      vi: "Hoàng thành Thăng Long",
      en: "Imperial Citadel of Thang Long",
    },
    description: {
      vi: "Di sản Thế giới được UNESCO công nhận. 1000 năm lịch sử hoàng cung Việt Nam được khai quật từng lớp một.",
      en: "UNESCO World Heritage site. 1000 years of Vietnamese royal history excavated layer by layer.",
    },
  },

  // ===== NATURE =====
  "west-lake-sunset-cycle": {
    name: {
      vi: "Đạp xe ngắm hoàng hôn Hồ Tây",
      en: "West Lake Sunset Cycle",
    },
    description: {
      vi: "Thuê chiếc xe đạp và dạo quanh Hồ Tây giờ vàng. 17km đường ven hồ với đầm sen và chùa chiền.",
      en: "Rent a bicycle and circle Tay Ho at golden hour. 17km of lakeside paths with lotus fields and pagodas.",
    },
  },

  "botanical-garden-of-hanoi": {
    name: {
      vi: "Vườn Bách Thảo Hà Nội",
      en: "Botanical Garden of Hanoi",
    },
    description: {
      vi: "Ốc đảo xanh yên bình gần khu lăng Bác. Cây đa cổ thụ, hồ nước và những gia đình tập thái cực quyền lúc rạng đông.",
      en: "A peaceful green oasis near the mausoleum. Banyan trees, ponds, and families doing tai chi at dawn.",
    },
  },

  "truc-bach-lake-morning-walk": {
    name: {
      vi: "Dạo sớm Hồ Trúc Bạch",
      en: "Truc Bach Lake Morning Walk",
    },
    description: {
      vi: "Nhỏ và ấm cúng hơn Hồ Tây. Ngắm người dân câu cá, bơi lội và tập thể dục từ 5h30 sáng.",
      en: "Smaller and more intimate than West Lake. Watch locals fish, swim, and exercise at 5:30 AM.",
    },
  },

  // ===== NIGHTLIFE =====
  "bia-hoi-corner": {
    name: {
      vi: "Ngã tư Bia hơi",
      en: "Bia Hoi Corner",
    },
    description: {
      vi: "Bia tươi rẻ nhất thế giới chỉ với 25 xu một cốc. Ghế nhựa, ngắm dòng người qua lại và những người bạn quen tức thì.",
      en: "The cheapest fresh beer in the world at 25 cents a glass. Plastic stools, people-watching, and instant friends.",
    },
  },

  "tadioto-cocktail-bar": {
    name: {
      vi: "Tadioto Cocktail Bar",
      en: "Tadioto Cocktail Bar",
    },
    description: {
      vi: "Bar cocktail văn chương ấm cúng trong một tòa nhà thời thuộc địa. Tên quán lấy từ chữ 'taxi' trong tiếng Việt cũ.",
      en: "Intimate literary cocktail bar in a colonial building. Named after the word for 'taxi' in old Vietnamese.",
    },
  },

  "polite-pub": {
    name: {
      vi: "Polite Pub",
      en: "Polite Pub",
    },
    description: {
      vi: "Một dive bar được yêu mến ở phố cổ, nơi du khách và người bản địa hòa mình bên ly bia rẻ và nhạc sôi động.",
      en: "A beloved Old Quarter dive bar where travelers and locals mix over cheap drinks and loud music.",
    },
  },

  "the-alchemist-cocktail-bar": {
    name: {
      vi: "The Alchemist Cocktail Bar",
      en: "The Alchemist Cocktail Bar",
    },
    description: {
      vi: "Cocktail thủ công pha chế từ nguyên liệu Việt Nam — gin ướp phở, bitters sả, kumquat sour.",
      en: "Craft cocktails using local Vietnamese ingredients — pho-infused gin, lemongrass bitters, kumquat sour.",
    },
  },

  "rooftop-at-lotte-center": {
    name: {
      vi: "Sân thượng Lotte Center",
      en: "Rooftop at Lotte Center",
    },
    description: {
      vi: "Đài quan sát và sky bar tầng 65 với tầm nhìn toàn cảnh Hà Nội. Đẹp nhất lúc hoàng hôn.",
      en: "65th-floor observation deck and sky bar with panoramic views of all Hanoi. Best at sunset.",
    },
  },

  // ===== WORKSHOP / EXPERIENCE =====
  "vietnamese-cooking-class-at-koto": {
    name: {
      vi: "Lớp học nấu ăn Việt Nam tại KOTO",
      en: "Vietnamese Cooking Class at KOTO",
    },
    description: {
      vi: "Học cách làm phở, nem cuốn và bánh cuốn cùng các bạn trẻ hoàn cảnh khó khăn được đào tạo làm đầu bếp. Vừa ý nghĩa, vừa ngon.",
      en: "Learn to make pho, spring rolls, and banh cuon with at-risk youth trained as chefs. Meaningful and delicious.",
    },
  },

  "dong-ho-woodblock-printing": {
    name: {
      vi: "In tranh khắc gỗ Đông Hồ",
      en: "Dong Ho Woodblock Printing",
    },
    description: {
      vi: "Thử sức với nghệ thuật in tranh khắc gỗ dân gian trong một xưởng gia đình ngay ngoại thành Hà Nội.",
      en: "Try your hand at traditional folk art woodblock printing in a family workshop outside Hanoi.",
    },
  },

  "lacquerware-workshop": {
    name: {
      vi: "Xưởng sơn mài",
      en: "Lacquerware Workshop",
    },
    description: {
      vi: "Học kỹ thuật sơn mài Việt Nam trăm năm tuổi trong một xưởng nhỏ ở Hoàn Kiếm.",
      en: "Learn the centuries-old Vietnamese lacquer technique in a small Hoan Kiem studio.",
    },
  },

  "pottery-village-bat-trang": {
    name: {
      vi: "Làng gốm Bát Tràng",
      en: "Pottery Village Bat Trang",
    },
    description: {
      vi: "Làng gốm 800 năm tuổi, nơi bạn có thể tự nặn, men và nung sản phẩm gốm của riêng mình.",
      en: "800-year-old ceramic village where you can mold, glaze, and fire your own pottery.",
    },
  },

  // ===== ART / GALLERY =====
  "vietnam-fine-arts-museum": {
    name: {
      vi: "Bảo tàng Mỹ thuật Việt Nam",
      en: "Vietnam Fine Arts Museum",
    },
    description: {
      vi: "Tòa nhà thời thuộc địa nguy nga lưu giữ hàng thế kỷ mỹ thuật Việt — từ sơn mài đến lụa và sơn dầu.",
      en: "Stunning colonial building housing centuries of Vietnamese art from lacquer to silk to oil.",
    },
  },

  "manzi-art-space": {
    name: {
      vi: "Manzi Art Space",
      en: "Manzi Art Space",
    },
    description: {
      vi: "Phòng tranh đương đại kiêm quán bar trong một biệt thự Pháp được phục dựng. Triển lãm luân phiên và những buổi trò chuyện cùng nghệ sĩ.",
      en: "Contemporary art gallery and bar in a restored French villa. Rotating exhibitions and artist talks.",
    },
  },

  "ceramic-road-along-red-river": {
    name: {
      vi: "Con đường Gốm sứ ven sông Hồng",
      en: "Ceramic Road along Red River",
    },
    description: {
      vi: "Bức tranh mosaic dài 4km dọc theo đê, ghép từ gạch gốm. Bức tường gốm dài nhất thế giới.",
      en: "A 4km mosaic mural along the dyke made from ceramic tiles. The longest ceramic wall in the world.",
    },
  },

  // ===== MORE HIDDEN GEMS =====
  "secret-garden-rooftop": {
    name: {
      vi: "Sân thượng Secret Garden",
      en: "Secret Garden Rooftop",
    },
    description: {
      vi: "Khu vườn sân thượng giấu kín trên một tòa nhà trông rất đỗi bình thường. Cơm Việt nhà nấu cùng tầm nhìn toàn cảnh phố cổ.",
      en: "Hidden rooftop garden above a nondescript building. Vietnamese home cooking with panoramic Old Quarter views.",
    },
  },

  "long-bien-bridge-walk": {
    name: {
      vi: "Dạo bộ cầu Long Biên",
      en: "Long Bien Bridge Walk",
    },
    description: {
      vi: "Bước trên cây cầu sắt Pháp trăm năm tuổi lúc rạng đông. Xe máy, tàu hỏa và đồng bằng sông Hồng trải dài phía dưới.",
      en: "Walk the century-old French iron bridge at dawn. Motorbikes, trains, and the Red River delta below.",
    },
  },

  "bun-bo-nam-bo-67": {
    name: {
      vi: "Bún bò Nam Bộ 67",
      en: "Bun Bo Nam Bo 67",
    },
    description: {
      vi: "Tô bún bò khô đúng chuẩn nhất Hà Nội. Xếp hàng ở Hàng Điếu để thưởng thức vị ngọt, chua, bùi hoàn hảo.",
      en: "The definitive dry beef noodle bowl in Hanoi. Queue up on Hang Dieu for the sweet, tangy, nutty perfection.",
    },
  },

  "quang-ba-flower-market-night": {
    name: {
      vi: "Chợ hoa Quảng Bá (đêm)",
      en: "Quang Ba Flower Market (Night)",
    },
    description: {
      vi: "Chợ đầu mối hoa của Hà Nội sống động từ 2 giờ sáng. Núi sen, hồng và cúc dưới ánh đèn gắt gao.",
      en: "Hanoi's wholesale flower market comes alive at 2AM. Mountains of lotus, roses, and chrysanthemums under harsh lights.",
    },
  },

  "st-joseph-s-cathedral": {
    name: {
      vi: "Nhà thờ Lớn Hà Nội",
      en: "St. Joseph's Cathedral",
    },
    description: {
      vi: "Nhà thờ tân Gothic xây từ năm 1886. Mặt tiền gợi cảm giác Paris; bước vào trong để tìm khoảng tĩnh lặng dưới những ô kính màu.",
      en: "Neo-Gothic cathedral built in 1886. The facade feels like Paris; step inside for stained glass quiet.",
    },
  },

  "dong-xuan-night-market": {
    name: {
      vi: "Chợ đêm Đồng Xuân",
      en: "Dong Xuan Night Market",
    },
    description: {
      vi: "Chợ đêm họp từ thứ Sáu đến Chủ nhật với hàng đồ ăn, quần áo và nhạc sống. Phố cổ náo nhiệt đỉnh điểm.",
      en: "Friday-to-Sunday night market with food stalls, clothes, and live music. Peak Old Quarter chaos.",
    },
  },

  "hoan-kiem-walking-street-weekend": {
    name: {
      vi: "Phố đi bộ Hồ Hoàn Kiếm cuối tuần",
      en: "Hoan Kiem Walking Street Weekend",
    },
    description: {
      vi: "Mỗi tối cuối tuần, xe cộ bị cấm quanh hồ. Nghệ sĩ đường phố, các gia đình và khung cảnh ngắm người tuyệt nhất châu Á.",
      en: "Cars banned around the lake every weekend evening. Street performers, families, and the best people-watching in Asia.",
    },
  },

  "museum-of-ethnology": {
    name: {
      vi: "Bảo tàng Dân tộc học Việt Nam",
      en: "Museum of Ethnology",
    },
    description: {
      vi: "Bảo tàng hay nhất Việt Nam. Kiến trúc các dân tộc thiểu số ấn tượng, trưng bày tương tác và mô hình nhà làng ngoài trời.",
      en: "The best museum in Vietnam. Stunning tribal architecture, interactive exhibits, and outdoor village replicas.",
    },
  },

  "west-lake-lotus-tea-ceremony": {
    name: {
      vi: "Nghi thức trà sen Hồ Tây",
      en: "West Lake Lotus Tea Ceremony",
    },
    description: {
      vi: "Nhâm nhi tách trà ướp hương sen hái lúc tinh sương từ Hồ Tây. Một nghi thức thiền định riêng có của người Hà Nội.",
      en: "Sip tea infused with lotus flowers harvested at dawn from West Lake. A meditative, uniquely Hanoian ritual.",
    },
  },

  "phung-hung-street-murals": {
    name: {
      vi: "Bích họa phố Phùng Hưng",
      en: "Phung Hung Street Murals",
    },
    description: {
      vi: "Con phố vòm cuốn thuộc địa được phục dựng, phủ kín tranh tường khổng lồ tái hiện đời sống phố cổ. Tuyệt vời cho ảnh đẹp.",
      en: "Restored colonial archway street with giant murals depicting Old Quarter life. Great for photography.",
    },
  },

  "tay-ho-shrimp-cake-stalls": {
    name: {
      vi: "Bánh tôm Hồ Tây",
      en: "Tay Ho Shrimp Cake Stalls",
    },
    description: {
      vi: "Bánh tôm chiên giòn tại các sạp ven hồ. Ngon nhất khi đứng ăn, chấm nước mắm chua ngọt.",
      en: "Crispy fried shrimp cakes at lakeside stalls. Best eaten standing, dipped in sweet fish sauce.",
    },
  },

  "hanoi-bike-tour-old-quarter": {
    name: {
      vi: "Tour xe đạp phố cổ Hà Nội",
      en: "Hanoi Bike Tour Old Quarter",
    },
    description: {
      vi: "Tour xe đạp có hướng dẫn qua những con ngõ hẹp đến mức xe máy cũng khó lọt. Buổi sáng là đẹp nhất.",
      en: "Guided bicycle tour through narrow alleys that motorbikes can't even fit through. Morning is best.",
    },
  },

  "lotte-observation-deck": {
    name: {
      vi: "Đài quan sát Lotte",
      en: "Lotte Observation Deck",
    },
    description: {
      vi: "Điểm ngắm cảnh cao nhất Hà Nội ở độ cao 272m. Có khu sàn kính dành cho người gan dạ. Tuyệt đẹp vào những ngày trời quang.",
      en: "Highest viewing point in Hanoi at 272m. Glass-floor section for the brave. Stunning on clear days.",
    },
  },
};
