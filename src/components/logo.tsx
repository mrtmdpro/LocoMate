import { cn } from "@/lib/utils";

export function LogoIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("w-8 h-8", className)} {...props}>
      <rect width="64" height="64" rx="16" fill="#FF8C30" />
      <circle cx="32" cy="32" r="16" stroke="white" strokeWidth="3" fill="none" />
      <circle cx="32" cy="32" r="2.5" fill="white" />
      <path d="M32 16V20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 44V48" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 32H20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M44 32H48" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 20L34 30L32 32L30 30Z" fill="white" />
      <path d="M32 44L30 34L32 32L34 34Z" fill="white" opacity="0.6" />
    </svg>
  );
}

export function LogoWordmark({
  className,
  variant = "default",
  ...props
}: React.SVGProps<SVGSVGElement> & { variant?: "default" | "white" | "mono" }) {
  const locoFill = variant === "white" ? "#FFFFFF" : "#3F6F60";
  const mateFill = variant === "white" ? "rgba(255,255,255,0.85)" : "#FF8C30";

  return (
    <svg viewBox="0 0 220 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("h-6", className)} {...props}>
      <text x="0" y="32" fontFamily="Sora, sans-serif" fontWeight="800" fontSize="34" letterSpacing="-2" fill={locoFill}>
        LOCO
      </text>
      <text x="108" y="32" fontFamily="Sora, sans-serif" fontWeight="500" fontSize="34" letterSpacing="-1" fill={mateFill}>
        MATE
      </text>
    </svg>
  );
}

export function LogoFull({
  className,
  size = "md",
  variant = "default",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "white" | "mono";
}) {
  const sizes = {
    sm: { icon: "w-7 h-7", text: "h-4", gap: "gap-1.5" },
    md: { icon: "w-9 h-9", text: "h-5", gap: "gap-2" },
    lg: { icon: "w-12 h-12", text: "h-7", gap: "gap-2.5" },
    xl: { icon: "w-16 h-16", text: "h-9", gap: "gap-3" },
  };
  const s = sizes[size];

  return (
    <div className={cn("flex items-center", s.gap, className)}>
      <LogoIcon className={s.icon} />
      <LogoWordmark className={s.text} variant={variant} />
    </div>
  );
}
