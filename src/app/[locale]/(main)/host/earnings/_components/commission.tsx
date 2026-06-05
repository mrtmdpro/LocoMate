import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { formatVndCompact } from "@/lib/format";

export function CommissionCard({
  commission,
}: {
  commission: {
    lifetimeGrossVnd: number;
    lifetimeCommissionVnd: number;
    lifetimeNetVnd: number;
    lifetimeRefundedVnd: number;
    bookingCount: number;
    commissionRate: number;
    currency: string;
  };
}) {
  const t = useTranslations("host.earnings");
  const pct = (commission.commissionRate * 100).toFixed(0);
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardContent className="p-5 lg:p-6 bg-gradient-to-br from-secondary to-[#1a3322] text-white space-y-4">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">{t("commission.title")}</h2>
          <p className="text-sm text-white/80 mt-0.5">
            {t("commission.subtitle", { pct })}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <CommissionTile label={t("commission.gross")} value={commission.lifetimeGrossVnd} />
          <CommissionTile label={t("commission.fee")} value={commission.lifetimeCommissionVnd} muted />
          <CommissionTile label={t("commission.net")} value={commission.lifetimeNetVnd} highlight />
        </div>
        <p className="text-xs text-white/70 tabular-nums">
          {t("commission.bookings", { n: commission.bookingCount })}
          {commission.lifetimeRefundedVnd > 0 && (
            <> · {t("commission.refunded", { amount: formatVndCompact(commission.lifetimeRefundedVnd) })}</>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function CommissionTile({ label, value, muted, highlight }: { label: string; value: number; muted?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest font-semibold text-white/70">{label}</p>
      <p className={`text-xl lg:text-2xl font-bold tabular-nums mt-0.5 ${highlight ? "text-[#A8C589]" : muted ? "text-white/80" : "text-white"}`}>
        {formatVndCompact(value)}
      </p>
    </div>
  );
}
