/**
 * Customized Tour Template catalog seed.
 *
 * Parallel to `seed-fixed-tours.ts` but for the *flexible* product line.
 * 9 themed day-plan templates that the traveler picks as a starting
 * point on `/plan/build`; each carries a bilingual title + subtitle +
 * story plus a 4-D personality vector for the cosine matcher
 * (`lib/cosine.rankByCosine` — same engine that ranks the Fixed Tour
 * Matrix).
 *
 * Vectors are designed to span the personality space so that the top
 * pick is meaningfully different for different user vectors. The 9
 * templates approximately divide as:
 *
 *   Heritage-leaning  : H1 (heritage + quiet), H2 (heritage + craft)
 *   Food-leaning      : F1 (food + social),    F2 (food, intense)
 *   Craft-leaning     : C1 (craft + heritage), C2 (art + craft)
 *   Quiet/slow        : Q1 (quiet, contemplative)
 *   Social/lively     : S1 (social + balanced)
 *   Balanced          : B1 (broad sampler, low directional preference)
 *
 * Bilingual content is required by the i18n contract — every template
 * must populate both `titleVi`/`titleEn` and `storyVi`/`storyEn`.
 *
 * Idempotent: re-runs `delete()` first, then re-inserts. Safe to call
 * repeatedly — the DB lands in the same canonical state.
 */
import type { drizzle as drizzleFn } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzleFn<typeof schema>>;

export type CustomizedTourTemplateTheme =
  | "heritage"
  | "food"
  | "craft"
  | "quiet"
  | "social"
  | "balanced";

export interface CustomizedTourTemplateSeed {
  templateId: string;
  titleVi: string;
  titleEn: string;
  subtitleVi: string;
  subtitleEn: string;
  theme: CustomizedTourTemplateTheme;
  storyVi: string;
  storyEn: string;
  durationMinutes: number;
  maxParticipants: number;
  basePriceVnd: number;
  /** 4-D vector [Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living]. */
  vector: [number, number, number, number];
}

const CUSTOMIZED_TOUR_TEMPLATE_SEED: CustomizedTourTemplateSeed[] = [
  /* ─── HERITAGE-LEANING ────────────────────────────────────────────── */
  {
    templateId: "LOCO_CT_H1",
    titleVi: "Văn nhân lữ khách",
    titleEn: "The Literary Wanderer",
    subtitleVi: "Một ngày của câu chữ, vôi vữa và những bức tường rêu.",
    subtitleEn: "A day of words, lime-wash, and moss-covered walls.",
    theme: "heritage",
    storyVi:
      "Bạn không đến Hà Nội để chụp ảnh. Bạn đến để đọc thành phố như đọc một cuốn sách dày — từ những bức tường vôi loang dấu thời gian, qua phòng tranh nhỏ trong ngõ, đến quán cà phê có một kệ sách đã ngả màu. Lịch trình mở từ Văn Miếu lúc sáng sớm, ghé một workshop thư pháp ngắn, ăn trưa nhẹ ở một quán phố cổ, rồi để chiều trôi trong một thư viện cộng đồng. Locomate sẽ chọn cho bạn những điểm dừng có người trông coi tử tế và bầu không khí đủ tĩnh để bạn đọc được tiếng thì thầm của thành phố.",
    storyEn:
      "You're not in Hanoi for the photos. You're here to read the city the way you'd read a thick book — through lime-washed walls patinated by time, through small galleries hidden down alleyways, through a coffee shop where the bookshelf has gone soft at the edges. Your day opens at the Temple of Literature at sunrise, takes in a short calligraphy workshop, settles for a quiet Old Quarter lunch, then lets the afternoon dissolve in a community library. Locomate picks stops with thoughtful caretakers and the kind of stillness that lets the city whisper to you.",
    durationMinutes: 480,
    maxParticipants: 4,
    basePriceVnd: 950_000,
    vector: [0.2, 0.6, 0.0, 0.2],
  },
  {
    templateId: "LOCO_CT_H2",
    titleVi: "Hà Nội của những cô đồng",
    titleEn: "Sacred Hanoi",
    subtitleVi: "Đền, miếu, và những vạt khói trầm dệt nên Thăng Long xưa.",
    subtitleEn: "Temples, shrines, and the incense smoke that wove old Thăng Long.",
    theme: "heritage",
    storyVi:
      "Trước khi là phố, Hà Nội là một mạng lưới đền miếu. Lịch trình này nối Đền Quán Thánh, Văn Miếu Quốc Tử Giám, và Đền Ngọc Sơn thành một vòng đi bộ — kèm một lát chè sen ven hồ và một bữa trưa chay ở một ngôi chùa nhỏ. Locomate sẽ chọn thời điểm sáng sớm để bạn nghe được tiếng chuông trước khi du khách kéo đến, và một hướng dẫn người Hà Nội cũ sẽ giải thích nghi thức bằng giọng kể của người trong nhà.",
    storyEn:
      "Before it became streets, Hanoi was a web of shrines. This day stitches Đền Quán Thánh, Văn Miếu, and Đền Ngọc Sơn into a single walking loop — punctuated by lakeside lotus tea and a vegetarian temple lunch. Locomate times your start at dawn so you hear the bells before the crowds arrive, and a local guide explains the ritual not as performance but as the family practice it has always been.",
    durationMinutes: 360,
    maxParticipants: 4,
    basePriceVnd: 820_000,
    vector: [0.1, 0.75, 0.05, 0.1],
  },

  /* ─── FOOD-LEANING ────────────────────────────────────────────────── */
  {
    templateId: "LOCO_CT_F1",
    titleVi: "Bếp ngách Hà Nội",
    titleEn: "Back-alley Kitchen Crawl",
    subtitleVi: "Bốn bữa, bốn ngõ, một câu chuyện vị giác.",
    subtitleEn: "Four meals, four alleys, one taste-bud arc.",
    theme: "food",
    storyVi:
      "Hà Nội ngon nhất ở chỗ ít người dám rẽ vào. Lịch trình này dẫn bạn qua một bát phở gánh trước 7 giờ sáng, một ổ bánh mì gốc cây ban trưa, một bữa bún chả ngõ thật bé buổi chiều, rồi đóng lại bằng một quán bia hơi với đậu phụ nướng. Locomate ưu tiên những quán mà chủ tự nấu và còn nhớ tên khách quen — và mỗi điểm dừng đều có một câu chuyện ngắn về vì sao công thức ấy ra đời.",
    storyEn:
      "Hanoi tastes best where you'd hesitate to turn. This day walks you through a sidewalk phở before 7 AM, a bánh mì stall under an old tree at noon, a bún chả in a back-alley pocket in the afternoon, and closes with a beer-hơi crawl that includes the city's best grilled tofu. Locomate prioritises places where the owner still does the cooking and remembers the regulars' names — and every stop carries a short story about how that recipe came to exist.",
    durationMinutes: 540,
    maxParticipants: 4,
    basePriceVnd: 1_100_000,
    vector: [0.0, 0.1, 0.7, 0.2],
  },
  {
    templateId: "LOCO_CT_F2",
    titleVi: "Buổi sáng vị giác",
    titleEn: "Tastebud Morning",
    subtitleVi: "Sáu điểm dừng, ba giờ, và một bụng đủ no đến chiều.",
    subtitleEn: "Six stops, three hours, and a stomach that lasts until evening.",
    theme: "food",
    storyVi:
      "Một buổi sáng ngắn nhưng đậm — sáu quán, mỗi quán một thử miếng. Cà phê trứng ngắn, bánh cuốn nóng, xôi gấc gói lá chuối, kem cốm Tràng Tiền, chè khoai môn, kết bằng một bát chao mới ép. Lịch trình đi bộ hoàn toàn, không quá 1,5 km tổng cộng. Locomate canh thời điểm để các quán đều mở mà chưa đông, và đặt phần trước để bạn không phải xếp hàng.",
    storyEn:
      "A short but loaded morning — six stops, one bite at each. A small egg coffee, hot bánh cuốn, sticky rice wrapped in banana leaf, Tràng Tiền green-rice ice cream, taro chè, closing on freshly pressed soy curd. The route is fully walkable, under 1.5 km total. Locomate times your arrival so every stop is open but not yet crowded, and pre-books portions so you skip the queue.",
    durationMinutes: 240,
    maxParticipants: 4,
    basePriceVnd: 680_000,
    vector: [0.0, 0.05, 0.85, 0.1],
  },

  /* ─── CRAFT-LEANING ───────────────────────────────────────────────── */
  {
    templateId: "LOCO_CT_C1",
    titleVi: "Bàn tay thợ",
    titleEn: "The Hands That Make",
    subtitleVi: "Một ngày bạn không nhìn — bạn làm.",
    subtitleEn: "A day you don't watch — you make.",
    theme: "craft",
    storyVi:
      "Bạn không muốn nhìn ai đó vẽ. Bạn muốn tay mình dính sơn. Lịch trình này ghép một workshop gốm sáng ở Bát Tràng với một workshop vẽ lụa hoặc thư pháp buổi chiều ở phố cổ — kèm bữa trưa quây quần với những người thợ. Tác phẩm bạn làm được Locomate đóng gói cẩn thận và giao về khách sạn trước hôm bay. Một ngày ngắn nhưng để lại thứ bạn có thể chạm vào.",
    storyEn:
      "You don't want to watch someone paint. You want paint on your hands. This day pairs a morning ceramics workshop in Bát Tràng with an afternoon silk-painting or calligraphy session in the Old Quarter — bookended by a long communal lunch with the artisans themselves. Locomate carefully packs whatever you make and delivers it to your hotel before your flight. A short day that leaves you with something you can touch.",
    durationMinutes: 480,
    maxParticipants: 4,
    basePriceVnd: 1_350_000,
    vector: [0.4, 0.25, 0.05, 0.3],
  },
  {
    templateId: "LOCO_CT_C2",
    titleVi: "Vẽ phố",
    titleEn: "Painting the Old Quarter",
    subtitleVi: "Sổ phác thảo, hộp màu nước, và một thành phố đang ngồi mẫu.",
    subtitleEn: "A sketchbook, a watercolour set, and a city sitting still for you.",
    theme: "craft",
    storyVi:
      "Phố cổ không vội — bạn cũng đừng vội. Lịch trình mở bằng một lớp ký họa nhanh với một họa sĩ địa phương, sau đó là buổi chiều đi bộ chậm trong phố với sổ phác thảo và một hộp màu nước nhỏ trong túi. Locomate đặt sẵn cho bạn ba quán cà phê có view đẹp để bạn dừng vẽ khi mỏi, và một bữa tối nhẹ ven hồ để kết một ngày đầy mực và màu.",
    storyEn:
      "The Old Quarter isn't in a hurry — neither should you be. Your day opens with a quick urban-sketching class led by a local painter, then unfolds as a slow afternoon of walking with the sketchbook and a small watercolour set in your bag. Locomate pre-arranges three cafés with sight-lines worth drawing so you can stop when your wrist tires, and a quiet lakeside dinner closes a day that ends in ink and pigment.",
    durationMinutes: 420,
    maxParticipants: 4,
    basePriceVnd: 980_000,
    vector: [0.65, 0.15, 0.0, 0.2],
  },

  /* ─── QUIET / SLOW ────────────────────────────────────────────────── */
  {
    templateId: "LOCO_CT_Q1",
    titleVi: "Chiều thư thái Tây Hồ",
    titleEn: "Slow West Lake Afternoon",
    subtitleVi: "Đạp xe ven hồ, trà sen, và một buổi chiều không lịch trình.",
    subtitleEn: "A bike along the lake, lotus tea, and an afternoon without a schedule.",
    theme: "quiet",
    storyVi:
      "Một ngày dài đôi khi bắt đầu bằng việc đi chậm lại. Lịch trình này thuê cho bạn một chiếc xe đạp ven Hồ Tây, dừng ở một quán trà sen có mái hiên thấp, ghé một ngôi chùa nhỏ ít người biết, rồi để bạn tự chọn nơi ngắm mặt trời lặn — Locomate đề xuất ba vị trí, không bắt bạn phải đi đủ. Không hướng dẫn viên, không mic, không người chụp ảnh — chỉ một ngày trả lại cho chính bạn.",
    storyEn:
      "A long day sometimes starts by going slower. This itinerary rents you a bike along West Lake, parks you at a lotus-tea pavilion with a low-tiled roof, drops in on a quiet pagoda most tourists miss, then leaves the sunset spot to you — Locomate suggests three, you pick. No guide, no microphone, no photographer — just one day handed back to you.",
    durationMinutes: 300,
    maxParticipants: 2,
    basePriceVnd: 520_000,
    vector: [0.15, 0.1, 0.1, 0.65],
  },

  /* ─── SOCIAL / LIVELY ─────────────────────────────────────────────── */
  {
    templateId: "LOCO_CT_S1",
    titleVi: "Hà Nội về đêm",
    titleEn: "Hanoi After Dark",
    subtitleVi: "Bia hơi, người mới, và một đường phố khác sau 9 giờ tối.",
    subtitleEn: "Beer hơi, new faces, and a different city after 9 PM.",
    theme: "social",
    storyVi:
      "Sau 8 giờ tối, Hà Nội đổi giọng. Lịch trình này gom bạn vào một bàn bia hơi ngã tư phố cổ, kèm một guide vui tính dẫn qua hai quán nhậu ngách và một quán karaoke đường phố. Locomate ghép bạn với một nhóm nhỏ 4–6 người khách quốc tế cùng tâm trạng để bạn có người trò chuyện, và kết thúc bằng một xe ôm chở bạn về tận cửa khách sạn — an toàn, vui, và đủ chuyện kể cho hôm sau.",
    storyEn:
      "After 8 PM, Hanoi shifts register. This itinerary parks you at a beer-hơi crossroads in the Old Quarter, brings in a playful guide who walks you through two back-alley nhậu spots and a sidewalk karaoke joint. Locomate pairs you with a small group of 4–6 international travellers in the same mood so you have company at the table, and closes with a motorbike-taxi door-to-door to your hotel — safe, lively, and worth at least one story the next morning.",
    durationMinutes: 240,
    maxParticipants: 6,
    basePriceVnd: 760_000,
    vector: [0.05, 0.1, 0.45, 0.4],
  },

  /* ─── BALANCED ────────────────────────────────────────────────────── */
  {
    templateId: "LOCO_CT_B1",
    titleVi: "Hà Nội cân bằng",
    titleEn: "Balanced Hanoi",
    subtitleVi: "Một chút văn, một chút vị, một chút thợ — và đủ chỗ trống để thở.",
    subtitleEn: "A touch of literature, a touch of taste, a touch of craft — and room to breathe.",
    theme: "balanced",
    storyVi:
      "Khi bạn không nghiêng hẳn về phía nào, đừng ép. Lịch trình này lấy một điểm dừng từ mỗi chiều của Hà Nội: một góc văn (một quán cà phê có sách), một bữa vị (một quán bún chả Locomate đã ăn thử ba lần), một workshop ngắn 90 phút (chọn gốm hoặc thư pháp tại chỗ), và một buổi chiều thả lỏng quanh Hồ Hoàn Kiếm. Mỗi miếng vừa đủ — không có miếng nào lấn miếng nào.",
    storyEn:
      "When you don't lean one way, don't force it. This itinerary takes one stop from each of Hanoi's directions: a literary corner (a café with bookshelves), a tasting moment (a bún chả Locomate has eaten at three times), a short 90-minute workshop (ceramics or calligraphy — you decide on the day), and a relaxed late afternoon around Hoàn Kiếm Lake. Every piece is just enough — none crowds the others.",
    durationMinutes: 420,
    maxParticipants: 4,
    basePriceVnd: 890_000,
    vector: [0.25, 0.25, 0.25, 0.25],
  },
];

export { CUSTOMIZED_TOUR_TEMPLATE_SEED };

/**
 * Idempotent seed. Deletes the existing customized template catalog,
 * then re-inserts the canonical set. Safe to call repeatedly.
 */
export async function seedCustomizedTourTemplates(
  db: Db,
): Promise<{ templateCount: number }> {
  await db.delete(schema.customizedTourTemplates);

  for (const tpl of CUSTOMIZED_TOUR_TEMPLATE_SEED) {
    await db.insert(schema.customizedTourTemplates).values({
      templateId: tpl.templateId,
      titleVi: tpl.titleVi,
      titleEn: tpl.titleEn,
      subtitleVi: tpl.subtitleVi,
      subtitleEn: tpl.subtitleEn,
      theme: tpl.theme,
      storyVi: tpl.storyVi,
      storyEn: tpl.storyEn,
      durationMinutes: tpl.durationMinutes,
      maxParticipants: tpl.maxParticipants,
      basePriceVnd: tpl.basePriceVnd,
      vector: tpl.vector,
    });
  }

  return { templateCount: CUSTOMIZED_TOUR_TEMPLATE_SEED.length };
}
