/**
 * Shared timeline-overlap detector.
 *
 * Used by `cart.get` (for the UI warning + disabled checkout button) and
 * by `order.createFromCart` (as a server-side hard block). Keeping one
 * implementation ensures the two surfaces never disagree -- the UI cannot
 * promise an overlap-free checkout that the server then accepts, nor
 * vice-versa.
 *
 * Items without both bounds (startsAt + endsAt) are skipped silently --
 * non-time-bound lines (merch, eSIM, guide_addon, same-day-only tickets
 * with no end) cannot conflict with anything.
 */

export type ConflictInput = {
  id: string;
  label: string;
  startsAt: string | Date | null | undefined;
  endsAt: string | Date | null | undefined;
};

export type ConflictPair = {
  idA: string;
  idB: string;
  labelA: string;
  labelB: string;
};

/**
 * Return every distinct pair of items whose time ranges overlap.
 *
 * Uses strict `<` boundaries so a slot ending at 14:00 does NOT conflict
 * with a slot starting at 14:00 (back-to-back bookings are legal). Any
 * interior overlap -- even a single minute -- does conflict.
 *
 * O(n^2) which is fine at cart sizes (<20); if carts ever balloon we can
 * switch to an interval-tree sweep.
 */
export function detectConflicts(items: ConflictInput[]): ConflictPair[] {
  const timed = items
    .map((it) => ({
      id: it.id,
      label: it.label,
      start: it.startsAt ? new Date(it.startsAt).getTime() : NaN,
      end: it.endsAt ? new Date(it.endsAt).getTime() : NaN,
    }))
    .filter((it) => Number.isFinite(it.start) && Number.isFinite(it.end));

  const out: ConflictPair[] = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (a.start < b.end && b.start < a.end) {
        out.push({ idA: a.id, idB: b.id, labelA: a.label, labelB: b.label });
      }
    }
  }
  return out;
}

/**
 * Convenience: returns true iff a proposed window [start, end) overlaps
 * ANY existing [start, end) in the list. Useful when you want to check a
 * single incoming booking against a set of existing ones without
 * constructing ConflictPair outputs (host-collision check in
 * experience.book, activity.addSlot).
 */
export function overlapsAny(
  proposed: { startsAt: string | Date; endsAt: string | Date },
  existing: Array<{ startsAt: string | Date; endsAt: string | Date }>,
): boolean {
  const pStart = new Date(proposed.startsAt).getTime();
  const pEnd = new Date(proposed.endsAt).getTime();
  for (const e of existing) {
    const eStart = new Date(e.startsAt).getTime();
    const eEnd = new Date(e.endsAt).getTime();
    if (pStart < eEnd && eStart < pEnd) return true;
  }
  return false;
}
