/**
 * Curated Fixed Tour catalog seed.
 *
 * Ports the 15-tour content from `docs/sửa .md` (sections 3 + 5.2) into
 * the `fixed_tours` / `fixed_tour_steps` / `fixed_tour_tags` tables.
 * Idempotent: re-runs `delete()` first, then re-inserts the canonical set,
 * so we can iterate on content without DB-out-of-sync surprises.
 *
 * Lat/long coverage is partial. The spec only fully specifies tour M1's
 * 3 stops with coordinates. The other 14 tours have step text but no
 * geo — those rows ship with `latitude = null, longitude = null` and the
 * content team can backfill via a future content sweep without a code
 * deploy (the steps table FK is CASCADE so re-seeding refreshes them
 * cleanly).
 */
import type { drizzle as drizzleFn } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzleFn<typeof schema>>;

export type FixedTourChapter =
  | "MORNING_SHIFT"
  | "AFTERNOON_SHIFT"
  | "EVENING_SHIFT";

export type FixedTourTagClass = "MATERIAL" | "PERSONA" | "KEYWORD";

interface FixedTourSeedStep {
  stepOrder: number;
  /** Minutes from tour start. 0 = meeting point. */
  targetTimeOffset: number;
  locationNameVi: string;
  locationNameEn: string;
  latitude?: number;
  longitude?: number;
  actionLogVi: string;
  actionLogEn: string;
}

interface FixedTourSeedTag {
  tagClass: FixedTourTagClass;
  tagKey: string;
}

export type PriceTier = "light" | "standard" | "premium";

/**
 * Fixed Tour pricing knobs. Replaces the prior hardcoded 1.0M-1.5M
 * basePriceVnd values with a derived formula that scales by stops +
 * duration + a per-tour tier. Tweak knobs here, re-run the seed,
 * every Fixed Tour reprices in one shot.
 */
const PRICE_KNOBS = {
  coordinationVnd: 250_000,
  perStopVnd: 80_000,
  perMinuteVnd: 1_200,
  tierMultiplier: { light: 0.85, standard: 1.0, premium: 1.25 },
} as const;

/**
 * Derives a tour price from its step list + tier. Duration is computed
 * from the last step's targetTimeOffset + 30 min tail (same model the
 * itinerary timeline uses). Result is snapped to the nearest 10,000 VND
 * for clean display.
 */
function fixedTourPrice(steps: FixedTourSeedStep[], tier: PriceTier = "standard"): number {
  const stops = steps.length;
  const lastStep = steps[steps.length - 1];
  const durationMin = (lastStep?.targetTimeOffset ?? 0) + 30;
  const raw =
    PRICE_KNOBS.coordinationVnd +
    stops * PRICE_KNOBS.perStopVnd +
    durationMin * PRICE_KNOBS.perMinuteVnd;
  const tiered = raw * PRICE_KNOBS.tierMultiplier[tier];
  return Math.round(tiered / 10_000) * 10_000;
}

interface FixedTourSeed {
  tourId: string;
  titleVi: string;
  titleEn: string;
  chapter: FixedTourChapter;
  storyScriptVi: string;
  storyScriptEn: string;
  tier?: PriceTier;
  durationMinutes?: number;
  maxParticipants?: number;
  /** 4-D vector [Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living]. */
  vector: [number, number, number, number];
  steps: FixedTourSeedStep[];
  tags: FixedTourSeedTag[];
}

/* ──────────────────────────────────────────────────────────────────────
 *  Tag helpers — keep the inline definitions short.
 * ────────────────────────────────────────────────────────────────────── */
const mat = (k: string): FixedTourSeedTag => ({ tagClass: "MATERIAL", tagKey: k });
const per = (k: string): FixedTourSeedTag => ({ tagClass: "PERSONA", tagKey: k });
const kw = (k: string): FixedTourSeedTag => ({ tagClass: "KEYWORD", tagKey: k });

/* ──────────────────────────────────────────────────────────────────────
 *  THE 15 CURATED FIXED TOURS
 *
 *  Content lifted from docs/sửa .md sections 1 (story + tags) and 3
 *  (titles + prices). Vectors from section 5.2. Step lat/long for M1
 *  from section 3 INSERT; remaining tours leave coordinates null until
 *  the content team backfills.
 * ────────────────────────────────────────────────────────────────────── */
const FIXED_TOUR_SEED: FixedTourSeed[] = [
  /* ─── CHƯƠNG 1: MORNING SHIFTS ─────────────────────────────────────── */

  {
    tourId: "LOCO_FT_M1",
    titleVi: "Hơi thở khởi nguyên",
    titleEn: "The Genesis Breath",
    chapter: "MORNING_SHIFT",
    storyScriptVi:
      "Hành trình đánh thức các giác quan bằng việc ngắm nhìn Hà Nội lúc chuyển giao từ đêm sang ngày, chạm vào nhịp lao động nguyên bản nhất ở chợ đầu mối và thưởng thức hương vị của buổi sớm mai.",
    storyScriptEn:
      "A journey to awaken the senses by witnessing Hanoi's transition from night to day, touching the rawest rhythms of pre-dawn labour at the wholesale market and tasting the flavours of early morning.",
    vector: [0.3, 0.0, 0.2, 0.5],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Chợ hoa đêm Quảng An",
        locationNameEn: "Quang An Night Flower Market",
        latitude: 21.0722,
        longitude: 105.8272,
        actionLogVi: "Đón không khí nhộn nhịp, xem giao thương hoa đêm.",
        actionLogEn: "Catch the bustling atmosphere; witness night flower trading.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 90,
        locationNameVi: "Cầu Long Biên",
        locationNameEn: "Long Bien Bridge",
        latitude: 21.0425,
        longitude: 105.8614,
        actionLogVi: "Tản bộ trên cầu cổ đón ánh bình minh đầu ngày.",
        actionLogEn: "Stroll on the ancient bridge to welcome the first sunrise.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 180,
        locationNameVi: "Hàng cháo chân cầu",
        locationNameEn: "Foot-of-Bridge Eatery",
        latitude: 21.041,
        longitude: 105.858,
        actionLogVi: "Thưởng thức cháo sườn sụn nóng hổi vỉa hè.",
        actionLogEn: "Enjoy hot rib porridge on the sidewalk.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 210,
        locationNameVi: "Đền Quán Thánh",
        locationNameEn: "Quan Thanh Temple",
        actionLogVi: "Ghé đền trấn Bắc của Thăng Long lúc sương sớm chưa tan.",
        actionLogEn:
          "Step into the northern guardian temple while the dawn mist still lingers.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 240,
        locationNameVi: "Cà phê trứng Giảng",
        locationNameEn: "Giang Egg Coffee",
        actionLogVi: "Ngụm cà phê trứng đầu ngày tại quán cổ nhất Hà Nội.",
        actionLogEn: "Open the day with egg coffee at Hanoi's oldest house of it.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 270,
        locationNameVi: "Vườn đào Nhật Tân",
        locationNameEn: "Nhat Tan Peach Garden",
        actionLogVi: "Tản bộ qua rặng đào hồng trước khi nắng lên cao.",
        actionLogEn: "Walk the rows of pink peach blossom before the sun climbs.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 295,
        locationNameVi: "Bánh giò Bà Tý",
        locationNameEn: "Bà Tý Steamed Rice Dumpling",
        actionLogVi: "Bánh giò nóng, mộc nhĩ giòn — bữa nhẹ kết tour.",
        actionLogEn: "Hot steamed dumpling with mushroom — a light end to the tour.",
      },
    ],
    tags: [
      mat("#ThanhTao"),
      mat("#HuongMen"),
      per("Slow_Living"),
      per("Aesthetic"),
      kw("Sunrise"),
      kw("Photography"),
      kw("Local_Life"),
      kw("Authentic_Breakfast"),
    ],
  },

  {
    tourId: "LOCO_FT_M2",
    titleVi: "Tiếng vọng kinh kỳ xưa",
    titleEn: "Echoes of the Ancient Academy",
    chapter: "MORNING_SHIFT",
    storyScriptVi:
      "Lần theo dấu mực tàu và những thớ đá nghìn năm để thấu cảm sâu sắc về đạo học, tinh thần tôn sư trọng đạo và cốt cách thanh tao của các bậc trí thức Nho học xứ Kinh Kỳ.",
    storyScriptEn:
      "Trace ink marks and thousand-year-old stone steles to deeply feel the ethos of learning, the spirit of veneration for teachers, and the refined character of the Confucian scholars of the capital.",
    vector: [0.1, 0.8, 0.0, 0.1],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Văn Miếu – Quốc Tử Giám",
        locationNameEn: "Temple of Literature",
        actionLogVi: "Tản bộ qua khu di tích lúc vắng khách.",
        actionLogEn: "Stroll through the temple complex before the crowds arrive.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 120,
        locationNameVi: "Trà quán ngách phố cổ",
        locationNameEn: "Old-Quarter Alley Tea House",
        actionLogVi:
          "Thưởng thức trà sen và nghe Tour Guide kể kịch bản về khoa cử xưa.",
        actionLogEn:
          "Sip lotus tea and listen to your guide recount the imperial examinations.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 180,
        locationNameVi: "Đền Bích Câu",
        locationNameEn: "Bich Cau Temple",
        actionLogVi: "Đền cổ thờ Tú Uyên, một góc Hà Nội ít người biết.",
        actionLogEn:
          "An overlooked temple to a scholar from Hanoi's old myths.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 210,
        locationNameVi: "Phở gà Hàng Trống",
        locationNameEn: "Pho Ga at Hang Trong",
        actionLogVi: "Bát phở gà thanh tao theo phong cách Hà thành xưa.",
        actionLogEn:
          "A clear-broth chicken phở in the refined old-Hanoi style.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 240,
        locationNameVi: "Nhà cổ 87 Mã Mây",
        locationNameEn: "87 Ma May Old House",
        actionLogVi:
          "Bước vào ngôi nhà ống Việt cổ điển từ thế kỷ 19.",
        actionLogEn:
          "Step into a classic 19th-century Vietnamese tube house.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 265,
        locationNameVi: "Chè sen long nhãn cô Hà",
        locationNameEn: "Lotus & Longan Sweet Soup",
        actionLogVi: "Chén chè sen long nhãn thanh mát kết tour.",
        actionLogEn:
          "A bowl of lotus-and-longan sweet soup to close the morning.",
      },
    ],
    tags: [
      mat("#ThanhTao"),
      per("Deep_History_Heritage"),
      kw("Confucianism"),
      kw("Ancient_Architecture"),
      kw("Lotus_Tea"),
      kw("Scholar_Story"),
    ],
  },

  {
    tourId: "LOCO_FT_M3",
    titleVi: "Tiếng động nhân sinh",
    titleEn: "Sounds of Human Existence",
    chapter: "MORNING_SHIFT",
    storyScriptVi:
      "Trải nghiệm một buổi sáng hòa mình vào thiên nhiên và những thanh âm dung dị, ngắm nhìn cách người Hà Nội tìm kiếm sự cân bằng và thong dong giữa lòng đô thị.",
    storyScriptEn:
      "Spend a morning steeped in nature and rustic sounds, watching the way Hanoians find balance and ease at the heart of the city.",
    vector: [0.25, 0.0, 0.25, 0.5],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Hồ Gươm",
        locationNameEn: "Hoan Kiem Lake",
        actionLogVi: "Đi bộ quanh hồ ngắm các cụ già tập thái cực quyền.",
        actionLogEn: "Walk the lake watching elders practise tai chi.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 60,
        locationNameVi: "Ngõ Từ Thọ",
        locationNameEn: "Tu Tho Alley",
        actionLogVi: "Rẽ vào ngõ cổ kính, ngắm tường rêu phong.",
        actionLogEn: "Slip into the ancient alley and study its mossy walls.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 120,
        locationNameVi: "Tiệm gốm mộc",
        locationNameEn: "Raw-Clay Studio",
        actionLogVi:
          "Nghe tiếng chuông gió và thưởng thức cà phê trứng đúng điệu.",
        actionLogEn:
          "Listen to wind chimes and savour a proper Hanoi egg coffee.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 150,
        locationNameVi: "Đền Ngọc Sơn",
        locationNameEn: "Ngoc Son Temple",
        actionLogVi:
          "Bước qua Cầu Thê Húc vào đền giữa hồ Hoàn Kiếm.",
        actionLogEn:
          "Cross the red Huc Bridge into the temple on Hoan Kiem Lake.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 180,
        locationNameVi: "Tào phớ ngõ Tô Tịch",
        locationNameEn: "Tofu Pudding Alley",
        actionLogVi: "Chén tào phớ thạch trắng, ngọt nhẹ nhàng.",
        actionLogEn:
          "A bowl of silky tofu pudding with light syrup.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 210,
        locationNameVi: "Phố Hàng Trống",
        locationNameEn: "Hang Trong Painting Street",
        actionLogVi: "Phố vẽ tranh dân gian Hàng Trống cổ kính.",
        actionLogEn: "The historic street of Hàng Trống folk painters.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 240,
        locationNameVi: "Bánh cuốn Hàng Bồ",
        locationNameEn: "Banh Cuon at Hang Bo",
        actionLogVi: "Bánh cuốn nóng tráng tay, ăn cùng chả quế.",
        actionLogEn:
          "Hand-rolled rice crêpes served hot with cinnamon sausage.",
      },
    ],
    tags: [
      mat("#ThanhTao"),
      mat("#HuongMen"),
      per("Slow_Living"),
      per("Aesthetic"),
      kw("Lake_Walk"),
      kw("Egg_Coffee"),
      kw("Tranquility"),
      kw("Mindfulness"),
    ],
  },

  {
    tourId: "LOCO_FT_M4",
    titleVi: "Ngõ nhỏ rêu phong",
    titleEn: "Mossy Alleyways",
    chapter: "MORNING_SHIFT",
    storyScriptVi:
      "Một hành trình xuyên không đi sâu vào những biên độ không gian hẹp nhất của Hà Nội, nơi những ngôi nhà hình ống và những mảng tường rêu phong kể câu chuyện về sự thích nghi kiến trúc qua thế kỷ.",
    storyScriptEn:
      "A time-warp journey into the narrowest spatial confines of Hanoi, where tube houses and mossy walls tell the story of architectural adaptation across the centuries.",
    vector: [0.0, 0.5, 0.4, 0.1],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Phố Hàng Chiếu",
        locationNameEn: "Hang Chieu Street",
        actionLogVi: "Khám phá hệ thống ngõ siêu nhỏ.",
        actionLogEn: "Explore the network of micro-alleys.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 60,
        locationNameVi: "Nhà cổ 87 Mã Mây",
        locationNameEn: "87 Ma May Old House",
        actionLogVi: "Bước vào căn nhà ống Pháp - Việt.",
        actionLogEn: "Step inside the Franco-Vietnamese tube house.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 150,
        locationNameVi: "Bún chả que tre ngách",
        locationNameEn: "Alley Bun Cha (bamboo skewer)",
        actionLogVi: "Ăn trưa bún chả que tre trong ngõ cổ điển.",
        actionLogEn: "Lunch on bamboo-skewer bun cha in a classic alley.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 180,
        locationNameVi: "Đền Bạch Mã",
        locationNameEn: "Bach Ma Temple",
        actionLogVi:
          "Đền thiêng phố Hàng Buồm, cổ kính bậc nhất Thăng Long.",
        actionLogEn:
          "Hang Buom's sacred temple — one of Thăng Long's oldest.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 210,
        locationNameVi: "Cà phê Đinh",
        locationNameEn: "Cafe Dinh",
        actionLogVi:
          "Căn gác cổ với ly cà phê trứng và view Hồ Gươm.",
        actionLogEn:
          "An attic café with egg coffee and a view of Hoan Kiem.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 240,
        locationNameVi: "Phố Lò Sũ",
        locationNameEn: "Lo Su Street",
        actionLogVi:
          "Con phố thủ công cổ với những căn nhà mặt tiền hẹp.",
        actionLogEn: "An old artisan street of narrow-fronted houses.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 265,
        locationNameVi: "Chè ngô Trần Hưng Đạo",
        locationNameEn: "Corn Sweet Soup",
        actionLogVi: "Chén chè ngô nóng, ngọt thanh kết tour.",
        actionLogEn: "A warming bowl of sweet corn soup to close.",
      },
    ],
    tags: [
      mat("#ThanhTao"),
      mat("#HuongMen"),
      per("Deep_History_Heritage"),
      per("Culinary_Enthusiast"),
      kw("Alleyway_Exploring"),
      kw("Traditional_Architecture"),
      kw("Bun_Cha"),
      kw("Hidden_Spaces"),
    ],
  },

  {
    tourId: "LOCO_FT_M5",
    titleVi: "Thức quà tinh khôi",
    titleEn: "The Pure Morning Gift",
    chapter: "MORNING_SHIFT",
    storyScriptVi:
      "Hành trình dành riêng cho những tín đồ sành ăn, đi sâu vào nghệ thuật nấu nước dùng và triết lý âm dương trong các món ăn sáng thanh nhã của người Bắc.",
    storyScriptEn:
      "A journey reserved for gourmands — into the art of broth-making and the yin-yang philosophy behind the refined breakfast cuisine of the North.",
    vector: [0.0, 0.1, 0.8, 0.1],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Phở bò gánh Hàng Chiếu",
        locationNameEn: "Carrying-Pole Phở at Hang Chieu",
        actionLogVi: "Bắt đầu ngày với một bát phở gánh.",
        actionLogEn: "Open the day with a bowl of carrying-pole phở.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 60,
        locationNameVi: "Bánh cuốn Thanh Trì",
        locationNameEn: "Thanh Tri Steamed Rolls",
        actionLogVi: "Thưởng thức bánh cuốn truyền thống không nhân.",
        actionLogEn: "Savour traditional fillingless steamed rice rolls.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 120,
        locationNameVi: "Cà phê cốt dừa vỉa hè",
        locationNameEn: "Coconut-Cream Coffee on the Kerb",
        actionLogVi: "Tráng miệng với cà phê cốt dừa.",
        actionLogEn: "Finish with coconut-cream coffee on the kerb.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 150,
        locationNameVi: "Xôi gà Yến",
        locationNameEn: "Yen Chicken Sticky Rice",
        actionLogVi:
          "Đĩa xôi gà nóng, thêm trứng và pate gan gà.",
        actionLogEn:
          "A plate of warm chicken sticky rice with egg and pâté.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 180,
        locationNameVi: "Phố Hàng Đào",
        locationNameEn: "Hang Dao Street",
        actionLogVi:
          "Phố lụa cổ — nghề dệt từ thế kỷ 15 còn vương đến nay.",
        actionLogEn:
          "The old silk street — weaving here dates to the 15th century.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 210,
        locationNameVi: "Bánh giò Đông Các",
        locationNameEn: "Banh Gio at Dong Cac",
        actionLogVi: "Bánh giò nóng vỉa hè, ăn kèm giò chả.",
        actionLogEn:
          "A hot steamed dumpling on the kerb with cured pork.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 240,
        locationNameVi: "Đền Ngọc Sơn",
        locationNameEn: "Ngoc Son Temple",
        actionLogVi:
          "Bước vào đền giữa hồ Hoàn Kiếm để dịu lại sau buổi sáng.",
        actionLogEn:
          "Step into the lake-island temple to settle after a busy morning.",
      },
    ],
    tags: [
      mat("#HuongMen"),
      per("Culinary_Enthusiast"),
      kw("Pho_Culture"),
      kw("Street_Food"),
      kw("Local_Taste"),
      kw("Culinary_Heritage"),
    ],
  },

  /* ─── CHƯƠNG 2: AFTERNOON SHIFTS ───────────────────────────────────── */

  {
    tourId: "LOCO_FT_A1",
    titleVi: "Men gốm ngàn năm",
    titleEn: "Thousand-Year Glaze",
    chapter: "AFTERNOON_SHIFT",
    storyScriptVi:
      "Rời xa phố thị để đến với dòng chảy phù sa sông Hồng, nơi du khách được hóa thân thành người thợ gốm, chạm vào thớ đất sét mộc mạc để dệt nên câu chuyện cá nhân của chính mình trên từng sản phẩm.",
    storyScriptEn:
      "Leave the city for the silt of the Red River, where travellers become potters — touching raw clay to weave their own personal story onto every piece.",
    tier: "premium",
    vector: [0.5, 0.1, 0.0, 0.4],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Đón ở Hoàn Kiếm",
        locationNameEn: "Pick-up at Hoan Kiem",
        actionLogVi: "Di chuyển bằng xe máy cổ đến Bát Tràng.",
        actionLogEn: "Vintage motorbike transfer out to Bát Tràng.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 60,
        locationNameVi: "Trung tâm tinh hoa gốm Việt",
        locationNameEn: "Vietnamese Ceramics Centre",
        actionLogVi: "Tham quan trung tâm tinh hoa gốm Việt.",
        actionLogEn: "Tour the centre of Vietnamese ceramics.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 120,
        locationNameVi: "Hiên nhà nghệ nhân lâu năm",
        locationNameEn: "Master Artisan's Veranda",
        actionLogVi: "Workshop tự tay vuốt nặn gốm.",
        actionLogEn: "Hands-on pottery workshop with the master.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 180,
        locationNameVi: "Đình Bát Tràng",
        locationNameEn: "Bat Trang Communal House",
        actionLogVi:
          "Đình làng cổ Bát Tràng, nơi thờ tổ nghề gốm.",
        actionLogEn:
          "The village shrine to the ancestor potters of Bát Tràng.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 210,
        locationNameVi: "Cơm gia đình nghệ nhân",
        locationNameEn: "Master's Family Lunch",
        actionLogVi:
          "Bữa cơm thân mật cùng gia đình nghệ nhân — canh cá rô phi, rau đồng.",
        actionLogEn:
          "A homey lunch with the master's family — tilapia soup and seasonal greens.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 245,
        locationNameVi: "Chợ gốm Bát Tràng",
        locationNameEn: "Bat Trang Pottery Market",
        actionLogVi:
          "Dạo chợ gốm với hàng nghìn món thủ công.",
        actionLogEn:
          "Wander the pottery market — thousands of handmade pieces.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 275,
        locationNameVi: "Nước vối nhà nghệ nhân",
        locationNameEn: "Voi-Leaf Tea at the Workshop",
        actionLogVi:
          "Chén nước vối truyền thống làng quê Bắc Bộ.",
        actionLogEn:
          "A cup of traditional voi-leaf tea — the village's everyday drink.",
      },
    ],
    tags: [
      mat("#HonDat"),
      mat("#ThanhTao"),
      per("Art_Aesthetic"),
      per("Slow_Living"),
      kw("Pottery_Making"),
      kw("Artisans"),
      kw("Handmade"),
      kw("Village_Culture"),
    ],
  },

  {
    tourId: "LOCO_FT_A2",
    titleVi: "Sắc điệp thời gian",
    titleEn: "Colors of Time",
    chapter: "AFTERNOON_SHIFT",
    storyScriptVi:
      "Tìm về cội nguồn của hội họa dân gian Việt Nam, thấu hiểu cách cha ông dùng xơ mướp, vỏ sò, lá tre để tạo nên những gam màu hội họa bất tử.",
    storyScriptEn:
      "Trace the roots of Vietnamese folk painting — understanding how the ancestors made enduring pigments from loofah, oyster shells, and bamboo leaves.",
    vector: [0.5, 0.4, 0.0, 0.1],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Bảo tàng Mỹ thuật Việt Nam",
        locationNameEn: "Vietnam National Fine Arts Museum",
        actionLogVi: "Tham quan có hướng dẫn.",
        actionLogEn: "Curated tour of the Fine Arts Museum.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 90,
        locationNameVi: "Workshop ngách Nguyễn Thái Học",
        locationNameEn: "Nguyen Thai Hoc Alley Workshop",
        actionLogVi: "Tự tay in tranh Đông Hồ trên giấy điệp.",
        actionLogEn: "Print Đông Hồ folk paintings on dó paper.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 150,
        locationNameVi: "Café Manzi nghệ thuật",
        locationNameEn: "Manzi Art Cafe",
        actionLogVi:
          "Không gian trưng bày nghệ thuật đương đại Hà Nội.",
        actionLogEn:
          "A contemporary art space in a colonial Hanoi townhouse.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 180,
        locationNameVi: "Cà phê muối phố cổ",
        locationNameEn: "Salt Coffee, Old Quarter",
        actionLogVi:
          "Vị mới của Hà Nội — ngụm cà phê muối béo nhẹ.",
        actionLogEn:
          "Hanoi's newest variant — a smooth, lightly salted coffee.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 210,
        locationNameVi: "Làng tranh Đông Hồ thu nhỏ",
        locationNameEn: "Mini Dong Ho Print Studio",
        actionLogVi:
          "Góc trưng bày tranh dân gian Đông Hồ trong phố cổ.",
        actionLogEn:
          "A pocket gallery of Đông Hồ folk prints in the Old Quarter.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 240,
        locationNameVi: "Chè cốm Tràng Tiền",
        locationNameEn: "Trang Tien Young-Rice Pudding",
        actionLogVi: "Chén chè cốm xanh non, hương lá dứa nhẹ.",
        actionLogEn:
          "A bowl of green young-rice pudding with pandan.",
      },
    ],
    tags: [
      mat("#HonDat"),
      per("Art_Aesthetic"),
      per("Deep_History_Heritage"),
      kw("Folk_Art"),
      kw("Painting_Workshop"),
      kw("Museum_Tour"),
      kw("Visual_Culture"),
    ],
  },

  {
    tourId: "LOCO_FT_A3",
    titleVi: "Thanh âm từ tre trúc",
    titleEn: "Melodies of Bamboo",
    chapter: "AFTERNOON_SHIFT",
    storyScriptVi:
      "Khám phá sự kỳ diệu của loài tre — biểu tượng cho khí chất con người Việt Nam, thông qua âm nhạc truyền thống và nghệ thuật tạo hình thủ công tinh xảo.",
    storyScriptEn:
      "Discover the wonder of bamboo — a symbol of the Vietnamese spirit — through traditional music and exquisite handcraft.",
    vector: [0.7, 0.2, 0.0, 0.1],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Nhà nghệ nhân Tây Hồ",
        locationNameEn: "West Lake Master's Home",
        actionLogVi: "Thăm một nghệ nhân làm nhạc cụ dân tộc.",
        actionLogEn: "Visit a master maker of folk instruments.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 60,
        locationNameVi: "Biểu diễn đàn t'rưng / sáo",
        locationNameEn: "T'rưng / Flute Performance",
        actionLogVi: "Thưởng thức màn biểu diễn ngắn.",
        actionLogEn: "Enjoy a short bamboo-xylophone performance.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 120,
        locationNameVi: "Workshop tre",
        locationNameEn: "Bamboo Workshop",
        actionLogVi: "Làm chuồn chuồn tre hoặc quạt giấy.",
        actionLogEn: "Craft a bamboo dragonfly or paper fan.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 150,
        locationNameVi: "Chùa Trấn Quốc",
        locationNameEn: "Tran Quoc Pagoda",
        actionLogVi:
          "Chùa cổ nhất Hà Nội, bên đảo nhỏ Hồ Tây.",
        actionLogEn:
          "Hanoi's oldest pagoda, on its tiny West Lake island.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 180,
        locationNameVi: "Bánh tôm Hồ Tây",
        locationNameEn: "West Lake Prawn Cake",
        actionLogVi: "Bánh tôm chiên giòn, ăn nóng bên hồ.",
        actionLogEn: "Crisp-fried prawn cakes eaten lakeside.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 210,
        locationNameVi: "Phủ Tây Hồ",
        locationNameEn: "Phu Tay Ho Shrine",
        actionLogVi:
          "Phủ thờ Mẫu Liễu Hạnh, một trong Tứ Bất Tử của Việt Nam.",
        actionLogEn:
          "A shrine to Mother Lieu Hanh — one of Vietnam's Four Immortals.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 240,
        locationNameVi: "Cà phê dừa Tây Hồ",
        locationNameEn: "Coconut Coffee, West Lake",
        actionLogVi:
          "Ly cà phê dừa thơm béo bên Hồ Tây gió mát.",
        actionLogEn:
          "A creamy coconut coffee with the breeze off West Lake.",
      },
    ],
    tags: [
      mat("#HonDat"),
      mat("#ThanhTao"),
      per("Art_Aesthetic"),
      kw("Traditional_Music"),
      kw("Bamboo_Craft"),
      kw("Acoustic_Experience"),
      kw("Artisan_Story"),
    ],
  },

  {
    tourId: "LOCO_FT_A4",
    titleVi: "Hương Sắc Tonkin",
    titleEn: "Scent of Tonkin",
    chapter: "AFTERNOON_SHIFT",
    storyScriptVi:
      "Chìm đắm trong không gian khứu giác cũ kỹ của xứ Bắc Kỳ, tìm hiểu về các loại thảo mộc tự nhiên và triết lý tĩnh tâm thông qua làn khói trầm thanh tao.",
    storyScriptEn:
      "Lose yourself in the old olfactory landscape of Tonkin — herbs, agarwood, and the still-mind philosophy carried on its quiet smoke.",
    vector: [0.3, 0.1, 0.1, 0.5],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Phố Hàng Chuối / Hàng Thuốc",
        locationNameEn: "Old Herb-Medicine Quarter",
        actionLogVi: "Khám phá phố thuốc Bắc cũ kỹ.",
        actionLogEn: "Walk the old Sino-Vietnamese herb quarter.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 60,
        locationNameVi: "Biệt thự Pháp cổ",
        locationNameEn: "Colonial French Villa",
        actionLogVi: "Workshop ngửi và thử nghiệm mùi hương.",
        actionLogEn: "Aroma sampling inside a colonial villa.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 120,
        locationNameVi: "Tự nén bánh hương",
        locationNameEn: "Press Your Own Incense",
        actionLogVi: "Tự tay nén một bánh hương trầm thảo mộc Việt.",
        actionLogEn: "Press your own herbal Vietnamese incense cake.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 150,
        locationNameVi: "Cửa hàng tinh dầu Lãn Ông",
        locationNameEn: "Lan Ong Essential Oils",
        actionLogVi:
          "Chai tinh dầu Bắc Kỳ truyền thống tự chọn mang về.",
        actionLogEn:
          "Pick a small bottle of traditional Tonkinese essential oil to take home.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 175,
        locationNameVi: "Trà sen Hồ Tây",
        locationNameEn: "West Lake Lotus Tea",
        actionLogVi: "Chén trà sen ướp thủ công, hương ngạt ngào.",
        actionLogEn:
          "A cup of hand-scented lotus tea, fragrant and deep.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 200,
        locationNameVi: "Thư phòng ngách Hàng Buồm",
        locationNameEn: "Hang Buom Reading Room",
        actionLogVi:
          "Không gian đọc thơ cổ trong ngách phố Hàng Buồm.",
        actionLogEn:
          "A reading room for classical poetry tucked into a Hang Buom alley.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 230,
        locationNameVi: "Chè hoa cau",
        locationNameEn: "Areca-Flower Sweet Soup",
        actionLogVi: "Chén chè trắng tinh, hương hoa cau thanh tao.",
        actionLogEn:
          "A pure-white sweet soup with the scent of areca flowers.",
      },
    ],
    tags: [
      mat("#HonDat"),
      mat("#HuongMen"),
      per("Slow_Living"),
      per("Aesthetic"),
      kw("Aroma_Workshop"),
      kw("French_Villa"),
      kw("Herbal_Medicine"),
      kw("Relaxation"),
    ],
  },

  {
    tourId: "LOCO_FT_A5",
    titleVi: "Những ô cửa màu khói",
    titleEn: "Smoky Windows",
    chapter: "AFTERNOON_SHIFT",
    storyScriptVi:
      "Hành trình ngắm nhìn những vết thương và vẻ đẹp lãng mạn lãng đãng của kiến trúc giao thoa Pháp - Việt nép dưới những vòm cây xà cừ rợp bóng.",
    storyScriptEn:
      "Walk the bruised, romantic beauty of Franco-Vietnamese architecture under canopies of indigenous shade trees.",
    vector: [0.45, 0.35, 0.2, 0.0],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Khu phố Pháp",
        locationNameEn: "French Quarter",
        actionLogVi: "Tản bộ qua Phan Đình Phùng, Hoàng Diệu.",
        actionLogEn: "Stroll Phan Đình Phùng and Hoàng Diệu.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 60,
        locationNameVi: "Nhà thờ Cửa Bắc",
        locationNameEn: "Cua Bac Cathedral",
        actionLogVi: "Thăm nhà thờ Cửa Bắc lịch sử.",
        actionLogEn: "Visit the historic Cửa Bắc cathedral.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 120,
        locationNameVi: "Ban công chung cư cũ",
        locationNameEn: "Old Apartment Balcony",
        actionLogVi: "Thưởng thức cà phê muối/bạc xỉu lộng gió.",
        actionLogEn: "Salt coffee on a breezy old apartment balcony.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 150,
        locationNameVi: "Nhà hát Lớn Hà Nội",
        locationNameEn: "Hanoi Opera House",
        actionLogVi:
          "Kiến trúc Pháp tiêu biểu, cảm hứng từ Opera Garnier.",
        actionLogEn:
          "The signature French build — inspired by Paris's Opera Garnier.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 180,
        locationNameVi: "Cà phê Tràng Tiền",
        locationNameEn: "Trang Tien Cafe",
        actionLogVi: "Ngụm bạc xỉu bên ô cửa sổ phố Pháp.",
        actionLogEn: "A bạc-xỉu coffee beside a French-Quarter window.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 210,
        locationNameVi: "Bưu điện Hà Nội",
        locationNameEn: "Hanoi Central Post Office",
        actionLogVi:
          "Toà nhà cổ kiểu Pháp ngay bờ Hồ Gươm.",
        actionLogEn:
          "The colonial-era post office right on Hoan Kiem's shore.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 240,
        locationNameVi: "Bánh croissant Maison Marou",
        locationNameEn: "Croissant at Maison Marou",
        actionLogVi: "Bánh croissant cùng chocolate Marou Việt Nam.",
        actionLogEn:
          "A flaky croissant with Marou Vietnamese chocolate.",
      },
    ],
    tags: [
      mat("#ThanhTao"),
      mat("#HuongMen"),
      per("Art_Aesthetic"),
      per("Deep_History_Heritage"),
      kw("Indochine_Architecture"),
      kw("French_Quarter"),
      kw("Balcony_View"),
      kw("Colonial_History"),
    ],
  },

  /* ─── CHƯƠNG 3: EVENING SHIFTS ─────────────────────────────────────── */

  {
    tourId: "LOCO_FT_E1",
    titleVi: "Hương thành phố",
    titleEn: "Intoxicating Aromas",
    chapter: "EVENING_SHIFT",
    storyScriptVi:
      "Một cuộc săn tìm hương vị bản địa đích thực trong bóng tối phố cổ. Đi qua những con ngõ sâu hun hút chỉ rộng vừa một người đi để tìm thấy những bếp ăn rực lửa truyền đời.",
    storyScriptEn:
      "An authentic local-flavour hunt in the Old Quarter's dark — winding through alleys barely wide enough for one body to find the inherited fires of generational kitchens.",
    vector: [0.0, 0.1, 0.9, 0.0],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Nộm bò khô Bờ Hồ",
        locationNameEn: "Dried-Beef Salad by Hoan Kiem",
        actionLogVi: "Bắt đầu với nộm bò khô bên hồ.",
        actionLogEn: "Open with dried-beef salad lakeside.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 45,
        locationNameVi: "Bún thang Bà Đức Hàng Hòm",
        locationNameEn: "Bún Thang at Hang Hom",
        actionLogVi: "Rẽ ngõ ăn bún thang truyền thống.",
        actionLogEn: "Slip into the alley for traditional bún thang.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 100,
        locationNameVi: "Bánh tôm Hàng Bồ",
        locationNameEn: "Prawn Fritters at Hang Bo",
        actionLogVi: "Ăn bánh tôm chiên giòn.",
        actionLogEn: "Crisp prawn fritters at Hàng Bồ.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 150,
        locationNameVi: "Chè sắn / chè bốn mùa vỉa hè",
        locationNameEn: "Sidewalk Sweet Soup",
        actionLogVi: "Tráng miệng bằng chè vỉa hè.",
        actionLogEn: "Sweet-soup dessert on the kerb.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 180,
        locationNameVi: "Phố Hàng Bè",
        locationNameEn: "Hang Be Street",
        actionLogVi:
          "Dạo phố Hàng Bè — phố chợ đêm sống động bậc nhất phố cổ.",
        actionLogEn:
          "Walk Hang Be — the Old Quarter's most alive night-market street.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 210,
        locationNameVi: "Phở cuốn Ngũ Xã",
        locationNameEn: "Pho Cuon at Ngu Xa",
        actionLogVi:
          "Cuốn phở mỏng nhân thịt bò xào, làng Ngũ Xã.",
        actionLogEn:
          "Beef-and-herb phở rolls from Ngũ Xã village.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 240,
        locationNameVi: "Đền Bà Kiệu",
        locationNameEn: "Ba Kieu Temple",
        actionLogVi:
          "Ngôi đền Mẫu cổ bên bờ Hồ Gươm.",
        actionLogEn:
          "An old Mother-goddess shrine on Hoan Kiem's edge.",
      },
      {
        stepOrder: 8,
        targetTimeOffset: 270,
        locationNameVi: "Rượu nếp cẩm Hàng Giấy",
        locationNameEn: "Hang Giay Sticky-Rice Wine",
        actionLogVi: "Chén rượu nếp cẩm tím ấm cuối tour.",
        actionLogEn: "A warm purple-sticky-rice wine to close.",
      },
    ],
    tags: [
      mat("#HuongMen"),
      per("Culinary_Enthusiast"),
      kw("Night_Street_Food"),
      kw("Alleyway_Dining"),
      kw("Local_Heritage_Food"),
      kw("Spicy_Sweet"),
    ],
  },

  {
    tourId: "LOCO_FT_E2",
    titleVi: "Tiếng rao đêm & Ký ức chợ Long Biên",
    titleEn: "Night Cries & Long Bien Memories",
    chapter: "EVENING_SHIFT",
    storyScriptVi:
      "Khi thành phố ngủ say, một thế giới khác thức giấc. Hành trình thấu cảm chiều sâu cuộc sống lao động về đêm của người dân nhập cư thông qua những tiếng rao và thanh âm mưu sinh.",
    storyScriptEn:
      "When the city sleeps, another world wakes. A journey of empathy with the depth of migrant night-labour, told through hawker calls and the soundscape of survival.",
    vector: [0.1, 0.4, 0.1, 0.4],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Xích lô dạo phố cổ",
        locationNameEn: "Cyclo Ride Through the Old Quarter",
        actionLogVi: "Đi xích lô nghe tiếng rao đêm.",
        actionLogEn: "Cyclo ride listening to the cries of night.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 60,
        locationNameVi: "Ốc luộc & bia hơi vỉa hè",
        locationNameEn: "Sidewalk Snails & Bia Hơi",
        actionLogVi: "Thưởng thức ốc luộc với bia hơi.",
        actionLogEn: "Boiled snails with draft bia hơi.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 180,
        locationNameVi: "Chợ Long Biên 22:00",
        locationNameEn: "Long Bien Market at 22:00",
        actionLogVi: "Đón những chuyến xe nông sản đầu tiên.",
        actionLogEn: "Catch the first farm-truck arrivals.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 210,
        locationNameVi: "Đền Quán Thánh",
        locationNameEn: "Quan Thanh Temple",
        actionLogVi: "Ghé đền trấn Bắc Thăng Long lúc đường vắng.",
        actionLogEn:
          "Visit the northern guardian temple while the streets are still.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 240,
        locationNameVi: "Bún chả que tre đêm",
        locationNameEn: "Late-Night Bamboo-Skewer Bun Cha",
        actionLogVi:
          "Bữa khuya bún chả que tre, chỉ mở từ 22h.",
        actionLogEn:
          "A late supper of bamboo-skewer bún chả that only opens after 22:00.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 270,
        locationNameVi: "Chợ đêm Đồng Xuân",
        locationNameEn: "Dong Xuan Night Market",
        actionLogVi:
          "Đi qua chợ đêm Đồng Xuân lúc tiểu thương dọn hàng.",
        actionLogEn:
          "Pass through Dong Xuan night market as the traders pack up.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 295,
        locationNameVi: "Trà chanh Nhà Thờ",
        locationNameEn: "Lemon Tea by the Cathedral",
        actionLogVi:
          "Trà chanh vỉa hè bên Nhà Thờ Lớn — vị trẻ Hà Nội.",
        actionLogEn:
          "Kerbside lemon tea by the Cathedral — Hanoi's youth ritual.",
      },
    ],
    tags: [
      mat("#ThanhTao"),
      mat("#HuongMen"),
      per("Slow_Living"),
      per("Deep_History_Heritage"),
      kw("Midnight_Tour"),
      kw("Bia_Hoi_Culture"),
      kw("Night_Market"),
      kw("Social_Discovery"),
    ],
  },

  {
    tourId: "LOCO_FT_E3",
    titleVi: "Hoàng Thành vang bóng",
    titleEn: "Imperial Citadel Echoes",
    chapter: "EVENING_SHIFT",
    storyScriptVi:
      "Hành trình văn hóa lịch sử kết hợp ẩm thực trang trọng, tái hiện lại những bữa tiệc hoàng cung cũ kỹ dưới ánh đèn vàng lãng mạn.",
    storyScriptEn:
      "A historical-cultural journey paired with formal cuisine — reviving the old imperial banquet under warm romantic lantern light.",
    tier: "premium",
    vector: [0.2, 0.5, 0.3, 0.0],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Tour đêm Hoàng Thành Thăng Long",
        locationNameEn: "Imperial Citadel Night Tour",
        actionLogVi:
          "Tham gia tour Giải mã Hoàng thành Thăng Long dưới ánh đèn lồng.",
        actionLogEn:
          "Join the Decoding-the-Citadel night tour under lanterns.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 120,
        locationNameVi: "Tiệm chả cá Lã Vọng cổ truyền",
        locationNameEn: "Cha Ca La Vong (traditional)",
        actionLogVi: "Bạn Lối dẫn ra tiệm cổ truyền lâu đời.",
        actionLogEn: "Your guide leads you to a centuries-old eatery.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 180,
        locationNameVi: "Cột cờ Hà Nội",
        locationNameEn: "Hanoi Flag Tower",
        actionLogVi:
          "Cột cờ trấn thủ Thăng Long, dưới ánh đèn vàng.",
        actionLogEn:
          "The flag tower that has guarded Thăng Long for two centuries.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 210,
        locationNameVi: "Trà cung đình",
        locationNameEn: "Royal Court Tea",
        actionLogVi: "Chén trà cung đình mạn lâu năm, hương cao quý.",
        actionLogEn:
          "A cup of aged royal-court tea, regal and slow.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 240,
        locationNameVi: "Văn Miếu chiếu đèn",
        locationNameEn: "Temple of Literature, Illuminated",
        actionLogVi:
          "Văn Miếu dưới hệ thống đèn lồng đỏ vàng — đêm hiếm có.",
        actionLogEn:
          "The Temple of Literature lit by red and gold lanterns — rarely seen at night.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 270,
        locationNameVi: "Rượu đế Hà Thành",
        locationNameEn: "Hanoi Rice Spirit",
        actionLogVi: "Chén rượu đế nếp ấm bụng kết bữa tiệc.",
        actionLogEn:
          "A small cup of warming rice spirit to close the banquet.",
      },
    ],
    tags: [
      mat("#ThanhTao"),
      mat("#HuongMen"),
      per("Deep_History_Heritage"),
      per("Culinary_Enthusiast"),
      kw("Citadel_by_Night"),
      kw("Royal_History"),
      kw("Cha_Ca"),
      kw("Fine_Dining_Experience"),
    ],
  },

  {
    tourId: "LOCO_FT_E4",
    titleVi: "Nghe tiếng di sản",
    titleEn: "Shadows and Silk",
    chapter: "EVENING_SHIFT",
    storyScriptVi:
      "Lắng nghe thứ âm nhạc bác học cổ truyền của Việt Nam được trình diễn trong không gian linh thiêng, tĩnh mịch của một ngôi đình cổ giữa lòng phố cổ đêm.",
    storyScriptEn:
      "Listen to Vietnam's classical scholar music performed in the sacred, hushed space of an ancient temple at the heart of the night Old Quarter.",
    vector: [0.4, 0.5, 0.0, 0.1],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Phố Hàng Đào / Hàng Bạc",
        locationNameEn: "Hang Dao / Hang Bac",
        actionLogVi: "Đi bộ dọc các phố nghề.",
        actionLogEn: "Walk the trade-craft streets.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 60,
        locationNameVi: "Đình Kim Ngân",
        locationNameEn: "Kim Ngan Temple",
        actionLogVi: "Thưởng thức Ca trù / Chèo cổ nguyên bản.",
        actionLogEn: "Attend an authentic Ca trù performance.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 120,
        locationNameVi: "Rượu nếp cái hoa vàng cuối đêm",
        locationNameEn: "Late-night Nep Cai Hoa Vang",
        actionLogVi: "Chạm nhẹ ly rượu cuối đêm.",
        actionLogEn: "A late-night sip of nếp cái hoa vàng.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 150,
        locationNameVi: "Đền Bạch Mã",
        locationNameEn: "Bach Ma Temple",
        actionLogVi:
          "Đền cổ phố Hàng Buồm, đèn nhang ấm trong đêm.",
        actionLogEn:
          "Hang Buom's old temple, lit by warm incense lamps at night.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 180,
        locationNameVi: "Bánh khúc Hàng Giấy",
        locationNameEn: "Banh Khuc at Hang Giay",
        actionLogVi:
          "Bánh khúc nóng, mộc nhĩ và mỡ hành — bữa khuya cổ điển.",
        actionLogEn:
          "Hot bánh khúc with wood-ear and scallion — a classic late-night bite.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 210,
        locationNameVi: "Phố Hàng Mã",
        locationNameEn: "Hang Ma Street",
        actionLogVi:
          "Phố giấy mã, đèn lồng — rực rỡ về đêm.",
        actionLogEn:
          "The street of paper-craft and lanterns — luminous after dark.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 240,
        locationNameVi: "Chè đỗ đen Hàng Bè",
        locationNameEn: "Black-Bean Sweet Soup, Hang Be",
        actionLogVi: "Chén chè đỗ đen mát kết đêm.",
        actionLogEn:
          "A bowl of black-bean sweet soup to end the night.",
      },
    ],
    tags: [
      mat("#ThanhTao"),
      mat("#HonDat"),
      per("Deep_History_Heritage"),
      per("Art_Aesthetic"),
      kw("Traditional_Opera"),
      kw("Ancient_Temple"),
      kw("Art_Performance"),
      kw("Midnight_Alcohol"),
    ],
  },

  {
    tourId: "LOCO_FT_E5",
    titleVi: "Giai điệu cuối ngõ",
    titleEn: "Melodies at Alley End",
    chapter: "EVENING_SHIFT",
    storyScriptVi:
      "Trải nghiệm một Hà Nội đương đại, lém lỉnh nhưng rất lãng mạn thông qua cách người trẻ cải biên những giá trị cũ thành không gian giải trí có gu.",
    storyScriptEn:
      "Experience a contemporary Hanoi — playful yet quietly romantic — through how its young recast old values into discerning leisure spaces.",
    vector: [0.5, 0.0, 0.2, 0.3],
    steps: [
      {
        stepOrder: 1,
        targetTimeOffset: 0,
        locationNameVi: "Vòm cầu Phùng Hưng",
        locationNameEn: "Phung Hung Mural Arches",
        actionLogVi: "Đi qua khu phố cổ ngắm tranh tường.",
        actionLogEn: "Walk past the murals on the railway arches.",
      },
      {
        stepOrder: 2,
        targetTimeOffset: 60,
        locationNameVi: "Quán Jazz gác mái",
        locationNameEn: "Attic Jazz Speakeasy",
        actionLogVi: "Rẽ vào quán Jazz/Acoustic trong căn gác mái.",
        actionLogEn: "Tuck into a Jazz/Acoustic attic speakeasy.",
      },
      {
        stepOrder: 3,
        targetTimeOffset: 120,
        locationNameVi: "Cocktail bản địa",
        locationNameEn: "Local Cocktail Bar",
        actionLogVi: "Nhâm nhi cocktail làm từ quất, húng láng.",
        actionLogEn: "Sip a kumquat / Vietnamese-mint cocktail.",
      },
      {
        stepOrder: 4,
        targetTimeOffset: 150,
        locationNameVi: "Phố Tạ Hiện",
        locationNameEn: "Ta Hien Street",
        actionLogVi:
          "Phố Tây của Hà Nội — bia hơi và rộn rã đêm muộn.",
        actionLogEn:
          "Hanoi's expat street — draft beer and late-night noise.",
      },
      {
        stepOrder: 5,
        targetTimeOffset: 180,
        locationNameVi: "Cà phê trứng gác mái",
        locationNameEn: "Attic Egg Coffee",
        actionLogVi: "Cà phê trứng trong căn gác cổ phố Bảo Khánh.",
        actionLogEn: "Egg coffee in an old attic above Bao Khanh street.",
      },
      {
        stepOrder: 6,
        targetTimeOffset: 210,
        locationNameVi: "Nhà thờ Lớn về đêm",
        locationNameEn: "St. Joseph's Cathedral at Night",
        actionLogVi:
          "Nhà thờ Cửa Bắc dưới ánh đèn vàng, gothic giữa phố cổ.",
        actionLogEn:
          "St. Joseph's Cathedral lit gold — gothic at the Old Quarter's edge.",
      },
      {
        stepOrder: 7,
        targetTimeOffset: 240,
        locationNameVi: "Phở chua Hàng Khoai",
        locationNameEn: "Sour Pho at Hang Khoai",
        actionLogVi: "Tô phở chua khuya, ăn đêm khoái khẩu.",
        actionLogEn:
          "A late-night sour-style phở — the city's favourite midnight bite.",
      },
    ],
    tags: [
      mat("#HuongMen"),
      mat("#ThanhTao"),
      per("Art_Aesthetic"),
      per("Slow_Living"),
      kw("Live_Jazz"),
      kw("Hidden_Bar"),
      kw("Local_Cocktail"),
      kw("Youth_Culture"),
    ],
  },
];

/* ──────────────────────────────────────────────────────────────────────
 *  Public exports
 * ────────────────────────────────────────────────────────────────────── */

export { FIXED_TOUR_SEED };

/**
 * Idempotent seed. Deletes the existing curated catalog (which cascades
 * to steps + tags via FK ON DELETE CASCADE), then re-inserts the canonical
 * 15. Safe to call repeatedly — every call leaves the DB in the same state.
 */
export async function seedFixedTours(db: Db): Promise<{ tourCount: number }> {
  // Cascade-deletes steps + tags via FK.
  await db.delete(schema.fixedTours);

  for (const tour of FIXED_TOUR_SEED) {
    await db.insert(schema.fixedTours).values({
      tourId: tour.tourId,
      titleVi: tour.titleVi,
      titleEn: tour.titleEn,
      chapter: tour.chapter,
      storyScriptVi: tour.storyScriptVi,
      storyScriptEn: tour.storyScriptEn,
      basePriceVnd: fixedTourPrice(tour.steps, tour.tier),
      durationMinutes: tour.durationMinutes ?? 240,
      maxParticipants: tour.maxParticipants ?? 6,
      vector: tour.vector,
    });

    if (tour.steps.length > 0) {
      await db.insert(schema.fixedTourSteps).values(
        tour.steps.map((s) => ({
          tourId: tour.tourId,
          stepOrder: s.stepOrder,
          targetTimeOffset: s.targetTimeOffset,
          locationNameVi: s.locationNameVi,
          locationNameEn: s.locationNameEn,
          latitude: s.latitude ?? null,
          longitude: s.longitude ?? null,
          actionLogVi: s.actionLogVi,
          actionLogEn: s.actionLogEn,
        })),
      );
    }

    if (tour.tags.length > 0) {
      await db.insert(schema.fixedTourTags).values(
        tour.tags.map((t) => ({
          tourId: tour.tourId,
          tagClass: t.tagClass,
          tagKey: t.tagKey,
        })),
      );
    }
  }

  return { tourCount: FIXED_TOUR_SEED.length };
}
