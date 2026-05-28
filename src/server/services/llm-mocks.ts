/**
 * Phase A.7 — mock response bank.
 *
 * Hand-written canned content keyed by `(feature, tone)`. Used whenever
 * `LLM_MOCK_MODE !== "false"` so the AI surfaces work end-to-end with
 * zero external API calls. The bank is deterministic-but-varied: for a
 * given `(feature, tone, sha1(prompt))` the same answer comes back, but
 * different prompts pick different pool entries so the chatbot doesn't
 * loop on the same canned line.
 *
 * To extend: add an entry under the relevant feature, keyed by tone, in
 * the right array. Use `{nickname}` and `{prompt}` as placeholders — the
 * mock interpolates them at render time.
 */

import { createHash } from "node:crypto";
import { DEFAULT_TONE, type AiTone, type LlmCall, type LlmFeature } from "./llm-types";

type ResponseBank = Record<LlmFeature, Record<AiTone, string[]>>;

const BANK: ResponseBank = {
  "personality-quiz": {
    "thu-thi": [
      "Bạn nói nghe có lý đấy. Vậy cho mình hỏi nhẹ — nếu chỉ có hai tiếng ở Hà Nội, bạn sẽ chọn ngồi yên một quán phin hay đi bộ đến tận cùng phố cổ?",
      "Mình lắng nghe nhé, {nickname}. Một câu nữa thôi — cuối ngày, bạn muốn về với cảm giác đã khám phá thêm điều gì, hay đã thật sự nghỉ ngơi?",
      "Đúng kiểu của bạn rồi. Cho mình hỏi thêm — bạn quen đi cùng nhóm, hay thích một mình hơn?",
    ],
    "hom-hinh": [
      "Ha, vibe nghe quen quen. Vậy — nếu Locomate đưa cho bạn một bản đồ trắng và 4 tiếng, bạn lấp đầy bằng phở hay bằng cà phê?",
      "Được rồi {nickname} ơi — câu khó: tour-guide nói nhiều quá thì bạn lịch sự gật, hay xin nghỉ giải lao bằng được?",
      "Hiểu rồi. Hỏi thêm: rủi mưa xuống giữa chừng, bạn xin một quán mới gần đó, hay vẫn đội mưa đi tiếp?",
    ],
    "truc-dien": [
      "Ghi nhận. Tiếp: tour 3 tiếng — bạn ưu tiên kiến thức, ẩm thực, hay không khí?",
      "OK {nickname}. Một câu nữa: nhóm 6 người, cặp đôi, hay solo?",
      "Rõ. Câu chốt: ngân sách thoải mái — bạn sẽ chi cho guide giỏi hay cho địa điểm ít người biết?",
    ],
  },

  "rerouting-rationale": {
    "thu-thi": [
      "Chỗ này yên hơn, có sân nhỏ — hợp với buổi chiều của bạn.",
      "{nickname} đã thích phin ban sáng; quán này pha cùng kiểu, ít người hơn.",
      "Cùng một con phố, nhưng quán này có cửa sổ nhìn ra mái ngói — đẹp lúc trời mưa.",
    ],
    "hom-hinh": [
      "Cùng vibe nhưng không bị Instagram lùa — bạn sẽ ngồi được lâu hơn.",
      "Quán kia đóng cửa rồi nhưng chỗ này còn ngon hơn 20%, hứa.",
      "Đi bộ 4 phút, đỡ nắng, có quạt trần — fair deal đúng không?",
    ],
    "truc-dien": [
      "Cùng category, cách 600 m, mở cửa.",
      "Đánh giá 4.8, 12 phút đi bộ, lịch trống.",
      "Chủ quán nói tiếng Anh, không có hàng đợi.",
    ],
  },

  "wrap-up-page": {
    "thu-thi": [
      "Hôm nay {nickname} đã ngồi rất lâu ở quán phin trong ngõ — chủ quán còn kể chuyện ông nội từng cung cấp cà phê cho lính Pháp. Một buổi sáng không vội.",
      "{nickname} bước qua cánh cửa đình Bạch Mã lúc nắng còn nghiêng — có một con mèo nằm dưới bậc thềm. Hà Nội đôi khi rất nhỏ, rất chậm.",
      "Đôi tay {nickname} hôm nay chạm vào đất sét lần đầu. Bà nghệ nhân cười, bảo: 'Lần sau cứ đến.' Một câu rất nhẹ, nhớ rất lâu.",
    ],
    "hom-hinh": [
      "{nickname} ăn tới ba bát bún đậu liên tiếp. Chị bán hàng còn nhớ. Hà Nội chuyện gì cũng nhớ.",
      "Sáng nay {nickname} dậy lúc 5h30 — thật ra đó là kỳ tích nhỏ. Ai cũng cần một kỳ tích nhỏ.",
      "{nickname} vẽ một con cá lên gốm. Trông giống con lợn. Nhưng đẹp theo cách của riêng nó.",
    ],
    "truc-dien": [
      "{nickname} hôm nay: 3 stop, 6.2 km, 1 món chưa thử bao giờ.",
      "Một sáng. Một làng nghề. Một tác phẩm gốm mang về.",
      "Đã ghé: Bạch Mã, 87 Mã Mây, phin trong ngõ. Tiếp theo: phía Tây Hồ.",
    ],
  },

  "thank-you-letter": {
    "thu-thi": [
      "Locomate cảm ơn {nickname} đã cùng đi qua một buổi sáng Hà Nội. Mong rằng phở ở quán cũ, phin trong ngõ, và câu chuyện 87 Mã Mây sẽ còn ở lại với bạn lâu hơn cả chuyến bay về. Hẹn gặp ở chuyến sau, dưới một mái ngói khác.",
      "{nickname} thân — một ngày cùng nhau đi qua những bức tường rêu phong đã khép lại. Có những địa danh không cần bạn nhớ tên, chỉ cần nhớ cảm giác đứng dưới nó. Đó là phần Locomate muốn gửi lại cho bạn.",
    ],
    "hom-hinh": [
      "{nickname} ơi — chủ quán phin còn hỏi 'bao giờ quay lại?' đấy. Locomate xin trả lời thay: sớm thôi. Cảm ơn vì đã đi cùng. Hẹn gặp ở chuyến sau, có thể là ngõ khác.",
      "Phở, bún, chè cốm — đã check. Áo dài đỏ trên đường về — đã check. Cảm ơn {nickname} vì đã không ngại thử. Hà Nội vẫn còn 70% chưa kể.",
    ],
    "truc-dien": [
      "{nickname}: cảm ơn vì chuyến đi. Đã ghé: 3 nơi. Đã thử: 2 món lần đầu. Còn lại: chuyến tiếp theo. Locomate ở đây khi bạn cần.",
      "Cảm ơn {nickname}. Chuyến hôm nay khép tại Hoàn Kiếm. Chuyến tới mở ở đâu là bạn chọn. Chúc đi đường tốt.",
    ],
  },
};

/**
 * Returns a deterministic mock response for `args`. Same prompt + tone +
 * feature always yields the same answer (good for screenshot tests and
 * idempotent demos), but different prompts pick different pool entries
 * so the chatbot doesn't loop.
 *
 * Placeholders supported: `{nickname}`, `{prompt}`.
 */
export function mockResponse(args: LlmCall): string {
  const tone = args.user?.tone ?? DEFAULT_TONE;
  const pool = BANK[args.feature]?.[tone] ?? [];
  if (pool.length === 0) {
    return `[mock:${args.feature}:${tone}]`;
  }
  // Hash the prompt so re-asking the same question yields the same
  // canned line. Mod by pool length to pick a variant.
  const idx = stablePick(args.feature + tone + args.prompt, pool.length);
  const tpl = pool[idx];
  return tpl
    .replaceAll("{nickname}", args.user?.nickname?.trim() || "bạn lữ khách")
    .replaceAll("{prompt}", args.prompt.slice(0, 60));
}

function stablePick(seed: string, mod: number): number {
  const h = createHash("sha1").update(seed).digest();
  // Read 4 bytes as a uint32, mod by pool length.
  const n = (h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3];
  return Math.abs(n) % mod;
}
