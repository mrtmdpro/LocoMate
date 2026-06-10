/**
 * Human-readable labels for à-la-carte order lines, shared by the order
 * history list (`order.getHistory`) and the payment history (`payment.getHistory`)
 * so a commerce purchase never renders as a nameless "Untitled Tour" again.
 *
 * `metadata.title` is captured at add-to-cart time (the activity / product
 * title in its default language); we fall back to a kind label when a
 * synthesized line (eSIM, guide add-on) carries no title.
 */
export function orderLineLabel(kind: string, metadata: unknown): string {
  const title = (metadata as { title?: string } | null)?.title;
  if (title) return title;
  switch (kind) {
    case "esim":
      return "eSIM";
    case "guide_addon":
      return "Guide add-on";
    case "merch":
      return "Merchandise";
    case "activity":
      return "Activity";
    default:
      return "Item";
  }
}

/** "Egg Coffee Workshop + 2 more" — first line label plus an overflow count. */
export function summarizeOrderLines(
  lines: { kind: string; metadata: unknown }[],
): string {
  if (lines.length === 0) return "Order";
  const first = orderLineLabel(lines[0]!.kind, lines[0]!.metadata);
  return lines.length > 1 ? `${first} + ${lines.length - 1} more` : first;
}
