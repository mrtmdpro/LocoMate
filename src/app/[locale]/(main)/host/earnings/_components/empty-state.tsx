import { Link } from "@/i18n/navigation";

// NOTE (Cluster F / Maint H): this is a LOCAL empty-state intentionally
// distinct from the shared `@/components/brand/empty-state.tsx`. The brand
// component renders a large illustration motif + "stamp" and takes an
// `illus` node plus an `actions` slot. The earnings dashboard wants the
// denser emoji + single-CTA treatment used throughout the financial tables,
// so the signatures do not match. Kept separate to preserve the existing
// rendering rather than forcing the heavier brand variant into table cards.
export function EmptyState({
  icon,
  title,
  body,
  href,
  cta,
}: {
  icon: string;
  title: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="text-center py-6 space-y-2">
      <div className="text-3xl">{icon}</div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto">{body}</p>
      {href && cta && (
        <Link href={href} className="inline-block text-sm font-semibold text-primary hover:text-brick pt-1">
          {cta} →
        </Link>
      )}
    </div>
  );
}
