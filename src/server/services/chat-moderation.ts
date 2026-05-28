/**
 * Chat moderation helpers.
 *
 * `applyContactInfoMask` scrubs off-platform contact attempts (phone
 * numbers, email, URLs, messenger handles). We SOFT-mask instead of
 * rejecting the message because legitimate meeting-point descriptions
 * ("7 Mã Mây, Hoàn Kiếm") would false-positive a strict URL reject.
 *
 * Callers get back `{ content, didMask }`: store the masked content,
 * and if anything was scrubbed flip `messages.flagged = true` so the
 * admin review queue can see the pattern.
 *
 * `moderateWithOpenAI` (optional, fire-and-forget via `waitUntil()`)
 * calls OpenAI's omni-moderation model and flips `flagged` on high-
 * confidence categories. Free per OpenAI ToS. Invoked by sendMessage
 * post-response so latency doesn't affect the user-visible path.
 */

const MASK = "\u2022\u2022\u2022"; // three bullets -- visually obvious "scrubbed"

// Each regex matches one category of off-platform contact signal. Kept
// independent so we can extend one without touching the others.
const PATTERNS: Array<{ name: string; re: RegExp }> = [
  // Vietnamese phone numbers (10-digit starting with 0, or +84 + 9 digits).
  { name: "vn_phone", re: /(?:\+?84|0)(?:\d[ .\-]?){9}/g },
  // Generic international phone numbers (7+ digits in a row, possibly
  // with separators). Deliberately conservative so a 4-digit street
  // number like "1234 Hang Dao" doesn't get masked.
  { name: "intl_phone", re: /\+?\d{1,3}[ .\-]?\(?\d{2,4}\)?[ .\-]?\d{3,4}[ .\-]?\d{3,4}/g },
  // Email addresses.
  { name: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // URLs / domains.
  { name: "url", re: /https?:\/\/\S+|\b[A-Za-z0-9-]{2,}\.(?:com|net|org|vn|io|app|co|me|ly|us)\b\S*/gi },
  // Messenger app handles. Case-insensitive; the word-boundary anchoring
  // keeps "whatsappening" from false-positiving.
  { name: "messenger", re: /\b(zalo|whatsapp|telegram|viber|line|wechat|messenger|signal)\b/gi },
];

export type MaskResult = { content: string; didMask: boolean };

export function applyContactInfoMask(content: string): MaskResult {
  let next = content;
  let didMask = false;
  for (const { re } of PATTERNS) {
    // Reset lastIndex between calls so successive tests with a global
    // regex don't accidentally skip matches.
    re.lastIndex = 0;
    if (re.test(next)) {
      didMask = true;
      next = next.replace(re, MASK);
    }
  }
  return { content: next, didMask };
}

/**
 * Optional LLM-based moderation pass. Wraps OpenAI's omni-moderation
 * endpoint; returns `{ flagged, category }`. Callers typically run this
 * in a post-response hook so it never blocks the send.
 *
 * The API key is read from OPENAI_MODERATION_KEY (falling back to
 * OPENAI_API_KEY) at call time. If neither is set, this is a no-op --
 * the feature degrades gracefully in preview / local dev.
 */
export async function moderateWithOpenAI(
  content: string,
): Promise<{ flagged: boolean; category: string | null }> {
  const key = process.env.OPENAI_MODERATION_KEY ?? process.env.OPENAI_API_KEY;
  if (!key) return { flagged: false, category: null };
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: content,
      }),
    });
    if (!res.ok) return { flagged: false, category: null };
    const json = (await res.json()) as {
      results?: Array<{
        flagged: boolean;
        categories: Record<string, boolean>;
        category_scores: Record<string, number>;
      }>;
    };
    const result = json.results?.[0];
    if (!result) return { flagged: false, category: null };
    // Only actually flag at high confidence; OpenAI flags eagerly.
    const tripped = Object.entries(result.category_scores ?? {})
      .find(([, score]) => score >= 0.8)?.[0];
    return { flagged: !!tripped, category: tripped ?? null };
  } catch {
    // Never throw from moderation -- the send path mustn't die because
    // OpenAI is rate-limiting us.
    return { flagged: false, category: null };
  }
}
