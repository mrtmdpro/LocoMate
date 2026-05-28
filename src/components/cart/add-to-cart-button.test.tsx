import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddToCartButton } from "./add-to-cart-button";

// Lightweight translation stub. Returns the key with a trailing label so
// tests can pin the exact phase being displayed without dragging in the
// real next-intl message loader. The real strings are covered separately
// by the i18n key existence check.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `cart.addButton.${key}`,
}));

const routerPushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string, opts?: unknown) => toastSuccess(msg, opts),
    error: (msg: string) => toastError(msg),
  },
}));

const flyToCartMock = vi.fn();
vi.mock("@/components/cart/fly-to-cart-context", () => ({
  useFlyToCart: () => ({
    flyToCart: flyToCartMock,
    registerBasketRef: () => () => {},
    subscribe: () => () => {},
    bumpCounter: 0,
  }),
}));

beforeEach(() => {
  routerPushMock.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
  flyToCartMock.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AddToCartButton -- state machine", () => {
  test("idle → pending → success → idle (auto-resets after 1.8s)", async () => {
    let resolveAdd: (() => void) | null = null;
    const onAdd = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolveAdd = res;
        }),
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AddToCartButton onAdd={onAdd} />);

    const button = screen.getByRole("button");
    expect(button.getAttribute("data-phase")).toBe("idle");
    expect(button.textContent).toContain("cart.addButton.idle");

    await user.click(button);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("data-phase")).toBe("pending");
    expect(button.textContent).toContain("cart.addButton.pending");
    expect((button as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      resolveAdd?.();
    });

    expect(button.getAttribute("data-phase")).toBe("success");
    expect(button.textContent).toContain("cart.addButton.success");
    expect(toastSuccess).toHaveBeenCalledOnce();
    expect(flyToCartMock).toHaveBeenCalledOnce();

    // Advance past the 1.8s reset window.
    await act(async () => {
      vi.advanceTimersByTime(1900);
    });

    expect(button.getAttribute("data-phase")).toBe("idle");
    expect(button.textContent).toContain("cart.addButton.idle");
  });

  test("failed add surfaces error toast and resets to idle without firing fly animation", async () => {
    const onAdd = vi.fn(async () => {
      throw new Error("Slot is not open");
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AddToCartButton onAdd={onAdd} />);
    const button = screen.getByRole("button");
    await user.click(button);

    // Allow the awaited promise rejection to settle.
    await act(async () => {
      await Promise.resolve();
    });

    expect(toastError).toHaveBeenCalledWith("Slot is not open");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(flyToCartMock).not.toHaveBeenCalled();
    expect(button.getAttribute("data-phase")).toBe("idle");
  });

  test("disabled prop blocks clicks (used for 'Sold out' / 'Pick a time')", async () => {
    const onAdd = vi.fn(async () => {});
    const user = userEvent.setup();

    render(<AddToCartButton onAdd={onAdd} disabled label="cart.addButton.soldOut" />);
    const button = screen.getByRole("button");

    expect(button.textContent).toContain("cart.addButton.soldOut");
    await user.click(button);
    expect(onAdd).not.toHaveBeenCalled();
  });

  test("toast success action navigates to /cart on click", async () => {
    const onAdd = vi.fn(async () => {});
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AddToCartButton onAdd={onAdd} />);
    await user.click(screen.getByRole("button"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(toastSuccess).toHaveBeenCalledOnce();
    const opts = toastSuccess.mock.calls[0][1] as {
      action?: { onClick: () => void; label: string };
    };
    expect(opts?.action?.label).toBe("cart.addButton.toast.viewCart");
    // Simulate the user clicking the toast action.
    opts.action!.onClick();
    expect(routerPushMock).toHaveBeenCalledWith("/cart");
  });

  test("double-click during pending is ignored (no double-add)", async () => {
    let resolveAdd: (() => void) | null = null;
    const onAdd = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolveAdd = res;
        }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<AddToCartButton onAdd={onAdd} />);
    const button = screen.getByRole("button");
    await user.click(button);
    await user.click(button);
    await user.click(button);

    expect(onAdd).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAdd?.();
    });
  });
});
