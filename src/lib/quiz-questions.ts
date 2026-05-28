/**
 * Phase A.8 — Personality-quiz script.
 *
 * Five questions, fixed order, deterministic branching. Each question has
 * 2–4 answer chips. The user's picks accumulate into a small score vector
 * that the client converts into a `personalityLabel` via `scorePersonality`.
 *
 * Why client-side scoring (in Phase A and Phase C alike): scoring is
 * cheap and deterministic; sending it through an LLM only adds latency
 * and cost. The LLM job in this flow is the conversational delivery of
 * each question, not the analysis of the answer.
 */

export type QuizAnswerId = string;

export interface QuizAnswer {
  id: QuizAnswerId;
  label: string;
  /** Sub-label rendered under the chip label in smaller type. Optional. */
  sub?: string;
  /** Score contribution. Each axis is summed across answers. The label
   *  resolver in `scorePersonality` reads these. */
  weight: { heritage?: number; food?: number; craft?: number; quiet?: number; social?: number };
}

export interface QuizQuestion {
  id: string;
  /** Vietnamese phrasing — the LLM streams an italicised version of this
   *  text into the chat. Kept here so we can fall back to deterministic
   *  text if the LLM ever fails / is rate-limited. */
  prompt: string;
  answers: QuizAnswer[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1-arrival",
    prompt:
      "Chào {nickname}. Mình muốn hiểu phong cách của bạn một chút nhé. Câu đầu — bạn vừa đến Hà Nội, có 2 tiếng rảnh. Bạn sẽ?",
    answers: [
      {
        id: "q1-walk",
        label: "Đi bộ một vòng phố cổ",
        sub: "Đọc thành phố như một quyển sách",
        weight: { heritage: 2, quiet: 1 },
      },
      {
        id: "q1-coffee",
        label: "Tìm một quán phin trong ngõ",
        sub: "Ngồi yên, nghe phố thở",
        weight: { quiet: 2, food: 1 },
      },
      {
        id: "q1-pho",
        label: "Ăn ngay một bát phở",
        sub: "Vị giác trước, mọi thứ sau",
        weight: { food: 2, social: 1 },
      },
      {
        id: "q1-meet",
        label: "Lên rooftop, gặp người mới",
        sub: "Mở cửa luôn",
        weight: { social: 2 },
      },
    ],
  },
  {
    id: "q2-guide",
    prompt: "OK. Vậy nếu có guide đi cùng, bạn muốn người như thế nào?",
    answers: [
      {
        id: "q2-researcher",
        label: "Nhà nghiên cứu thâm trầm",
        sub: "Biết sâu, kể chậm",
        weight: { heritage: 2, quiet: 1 },
      },
      {
        id: "q2-buddy",
        label: "Người bạn lém lỉnh",
        sub: "Sinh viên năng động, đi vui",
        weight: { social: 2 },
      },
      {
        id: "q2-foodie",
        label: "Người mê ăn ngách",
        sub: "Biết quán nào ngon hơn nói",
        weight: { food: 2, craft: 1 },
      },
    ],
  },
  {
    id: "q3-workshop",
    prompt:
      "Trong tour có 90 phút trống. Bạn dùng vào?",
    answers: [
      {
        id: "q3-craft",
        label: "Lớp gốm với nghệ nhân",
        sub: "Tự tay làm, mang về",
        weight: { craft: 2 },
      },
      {
        id: "q3-museum",
        label: "Bảo tàng Lịch sử",
        sub: "Đi sâu vào quá khứ",
        weight: { heritage: 2 },
      },
      {
        id: "q3-food-tour",
        label: "Food tour 3 quán ngách",
        sub: "Một ổ quà vị giác",
        weight: { food: 2 },
      },
      {
        id: "q3-cafe",
        label: "Ngồi yên với một cuốn sách",
        sub: "Hà Nội đôi khi cần dừng",
        weight: { quiet: 2 },
      },
    ],
  },
  {
    id: "q4-rain",
    prompt: "Đột nhiên mưa lớn. Lịch đảo lộn. Bạn?",
    answers: [
      {
        id: "q4-pivot-quiet",
        label: "Tìm một quán cà phê có mái hiên",
        sub: "Đổi gu, không đổi mood",
        weight: { quiet: 2 },
      },
      {
        id: "q4-pivot-craft",
        label: "Đề nghị đổi sang lớp workshop trong nhà",
        sub: "Tận dụng cơ hội",
        weight: { craft: 2 },
      },
      {
        id: "q4-pivot-anyway",
        label: "Mặc áo mưa, đi tiếp",
        sub: "Một câu chuyện hay là một câu chuyện hay",
        weight: { social: 1, heritage: 1 },
      },
    ],
  },
  {
    id: "q5-souvenir",
    prompt: "Cuối chuyến, một món để mang về?",
    answers: [
      {
        id: "q5-pottery",
        label: "Chiếc bát gốm tự nặn",
        sub: "Có một câu chuyện gắn vào",
        weight: { craft: 2 },
      },
      {
        id: "q5-book",
        label: "Một cuốn sách về Hà Nội",
        sub: "Giọng văn xưa",
        weight: { heritage: 2, quiet: 1 },
      },
      {
        id: "q5-recipe",
        label: "Một công thức nấu chè",
        sub: "Hương vị mang về",
        weight: { food: 2 },
      },
      {
        id: "q5-photos",
        label: "Một album ảnh chân dung",
        sub: "Khung hình với người mới gặp",
        weight: { social: 2 },
      },
    ],
  },
];

export interface ScoreVector {
  heritage: number;
  food: number;
  craft: number;
  quiet: number;
  social: number;
}

/**
 * Project the 5-axis quiz score into the 4-axis space used by the Fixed
 * Tour catalog's cosine matcher (`server/lib/cosine.ts`).
 *
 *   w1 = craft     → Art_Aesthetic
 *   w2 = heritage  → Deep_History_Heritage
 *   w3 = food      → Culinary_Enthusiast
 *   w4 = quiet     → Slow_Living
 *
 * The `social` axis has no equivalent in the spec's 4-D space. Rather
 * than drop the signal entirely, we softly redistribute it 50/50 into
 * `craft` (Art_Aesthetic) and `quiet` (Slow_Living) — those are the two
 * axes that read most "experiential" and best capture the social-axis
 * answer flavour (the rooftop/karaoke chip leans Aesthetic; the
 * "appreciate Hanoi quietly" chip leans Slow Living).
 *
 * Output is L2-normalized so the cosine math downstream is stable
 * regardless of how many questions the user actually answered.
 *
 * Returns the zero vector when ALL axes are zero (user submitted the
 * quiz with no answers picked) — the matcher returns 0 for that input
 * and the UI falls back to canonical ordering.
 */
export function toVectorV4(
  vector: ScoreVector,
): [number, number, number, number] {
  const socialShare = vector.social * 0.5;
  const raw: [number, number, number, number] = [
    vector.craft + socialShare,
    vector.heritage,
    vector.food,
    vector.quiet + socialShare,
  ];
  const norm = Math.sqrt(raw.reduce((acc, v) => acc + v * v, 0));
  if (norm === 0) return [0, 0, 0, 0];
  return [
    raw[0] / norm,
    raw[1] / norm,
    raw[2] / norm,
    raw[3] / norm,
  ];
}

/**
 * Resolves a personality label from the accumulated score vector.
 * Brand-canonical labels (italic-serif, Vietnamese):
 *
 *   "Người Hoài Cổ"     — heritage dominant
 *   "Lữ Khách Vị Giác"  — food dominant
 *   "Bàn Tay Tỉ Mỉ"     — craft dominant
 *   "Linh Hồn Tĩnh"     — quiet dominant
 *   "Người Mở Cửa"      — social dominant
 *   "Hồn Đa Cảm"        — tie / no clear dominant
 */
export function scorePersonality(answers: QuizAnswer[]): {
  vector: ScoreVector;
  label: string;
  axis: keyof ScoreVector | "balanced";
} {
  const vector: ScoreVector = { heritage: 0, food: 0, craft: 0, quiet: 0, social: 0 };
  for (const a of answers) {
    for (const [k, v] of Object.entries(a.weight)) {
      if (k in vector && typeof v === "number") {
        vector[k as keyof ScoreVector] += v;
      }
    }
  }
  const entries = Object.entries(vector) as [keyof ScoreVector, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [topKey, topVal] = entries[0];
  const [, secondVal] = entries[1];

  // Tie / balanced if the leader is within 1 point of the runner-up.
  if (topVal - secondVal <= 1) {
    return { vector, label: "Hồn Đa Cảm", axis: "balanced" };
  }
  const LABELS: Record<keyof ScoreVector, string> = {
    heritage: "Người Hoài Cổ",
    food: "Lữ Khách Vị Giác",
    craft: "Bàn Tay Tỉ Mỉ",
    quiet: "Linh Hồn Tĩnh",
    social: "Người Mở Cửa",
  };
  return { vector, label: LABELS[topKey], axis: topKey };
}
