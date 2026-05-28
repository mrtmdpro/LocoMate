"use client";

import { useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFlyToCart } from "@/components/cart/fly-to-cart-context";

const SUCCESS_DURATION_MS = 1800;

type ButtonVariant =
  | "default"
  | "forest"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link";

type ButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "brand"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";

interface AddToCartButtonProps {
  /**
   * Async work that performs the actual `cart.add` mutation(s). Resolves
   * on full success (after every mutation completes). Rejects on any
   * failure -- the button surfaces an error toast and resets.
   *
   * Hold the mutation logic in the parent so pages that compose multiple
   * adds (activity + guide_addon) can sequence them correctly. This
   * component owns nothing but the UX states.
   */
  onAdd: () => Promise<void>;
  /**
   * Override the default "Thêm vào giỏ" idle label. Use for context
   * labels like "Sold out", "Pick a time above", or other gating copy.
   */
  label?: string;
  /**
   * Image URL used as the visual that "flies" to the cart icon on
   * success. Falls back to a neutral chip when absent or when reduced
   * motion is preferred.
   */
  flyImage?: string | null;
  /**
   * Show toast on success. Default true. Pages can set false if they
   * already surface their own confirmation (e.g. a wizard step).
   */
  showSuccessToast?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/**
 * Single source of truth for every "Add to cart" interaction across
 * shop / activities / eSIM. Centralizes:
 *
 *   - idle / pending / success state machine (success auto-resets after
 *     1.8s back to idle)
 *   - Vietnamese-first labels via `cart.addButton.*`
 *   - fly-to-basket micro-interaction (skipped under `prefers-reduced-motion`)
 *   - success toast with a "Xem giỏ hàng" action -- explicit navigation
 *     instead of the old auto-redirect that swallowed user feedback
 *   - error toast surfacing the server's TRPC message
 *
 * Why centralize: the audit found three near-identical add buttons that
 * had drifted (one auto-navigated, one used hardcoded EN, one fired the
 * second mutation after the page unmounted). Folding them into this one
 * component is the regression-proofing.
 */
export function AddToCartButton({
  onAdd,
  label,
  flyImage,
  showSuccessToast = true,
  disabled,
  variant = "default",
  size = "brand",
  className,
}: AddToCartButtonProps) {
  const t = useTranslations("cart.addButton");
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { flyToCart } = useFlyToCart();

  const [phase, setPhase] = useState<"idle" | "pending" | "success">("idle");

  const handleClick = useCallback(async () => {
    if (phase !== "idle") return;
    setPhase("pending");
    try {
      await onAdd();
      const origin = buttonRef.current?.getBoundingClientRect() ?? null;
      flyToCart({ origin, image: flyImage ?? null });
      setPhase("success");
      if (showSuccessToast) {
        toast.success(t("toast.success"), {
          description: t("toast.description"),
          action: {
            label: t("toast.viewCart"),
            onClick: () => router.push("/cart"),
          },
          duration: 4000,
        });
      }
      window.setTimeout(() => setPhase("idle"), SUCCESS_DURATION_MS);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err && typeof err.message === "string"
          ? err.message
          : t("toast.addFailed");
      toast.error(message);
      setPhase("idle");
    }
  }, [phase, onAdd, flyImage, flyToCart, showSuccessToast, t, router]);

  const isPending = phase === "pending";
  const isSuccess = phase === "success";

  const displayLabel = isSuccess
    ? t("success")
    : isPending
      ? t("pending")
      : (label ?? t("idle"));

  return (
    <Button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      disabled={disabled || isPending}
      variant={isSuccess ? "forest" : variant}
      size={size}
      aria-live="polite"
      className={cn("transition-colors", className)}
      data-phase={phase}
    >
      {isSuccess ? (
        <CheckIcon className="size-4" />
      ) : isPending ? (
        <SpinnerIcon className="size-4" />
      ) : null}
      <span>{displayLabel}</span>
    </Button>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}
