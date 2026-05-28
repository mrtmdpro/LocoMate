import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HostExperienceWizard } from "../_wizard";
import { HOST_TOUR_PRICING } from "@/lib/pricing";

// Wizard tests. Client-side behavior only: step progression guard, publish
// button gating on host verification + content validity, live pricing
// breakdown rendering. tRPC mutations are mocked at the module level so the
// component is exercised without PGlite. The underlying router behavior is
// covered in host-experience.router.test.ts.

vi.mock("@/lib/trpc", () => {
  const makeMutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => ({ id: "draft-id-1" })),
    isPending: false,
  });
  return {
    trpc: {
      useUtils: () => ({
        hostExperience: {
          listMine: { invalidate: vi.fn() },
        },
      }),
      hostExperience: {
        create: { useMutation: () => makeMutation() },
        update: { useMutation: () => makeMutation() },
        publish: {
          useMutation: (opts: { onSuccess?: (row: { id: string }) => void }) => {
            const m = makeMutation();
            m.mutate = vi.fn(() => {
              opts?.onSuccess?.({ id: "published-id-1" });
            }) as typeof m.mutate;
            return m;
          },
        },
      },
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

/** Valid data that satisfies the wizard's client-side content rules. */
function validInitial() {
  return {
    id: "existing-draft-id",
    title: "Authentic Hanoi Walk",
    subtitle: "Morning coffee + temple",
    description:
      "A thoughtful morning walk through the Old Quarter with a stop for egg coffee at Giang and a visit to Bach Ma Temple. I'll share local history, vendor stories, and the best angle for your morning photos.",
    category: "cultural",
    durationMinutes: 180,
    priceAmount: 1_000_000,
    maxGroupSize: 4,
    photos: [
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
      "https://example.com/c.jpg",
    ],
    highlights: ["Hidden cafe", "Temple visit"],
    included: ["Bottled water"],
    schedule: [
      { time: "09:00", label: "Meet at Hoan Kiem Lake" },
    ],
  };
}

// vanilla assertion helpers (no @testing-library/jest-dom dependency).
function isDisabled(btn: HTMLElement): boolean {
  return (btn as HTMLButtonElement).disabled === true;
}

describe("HostExperienceWizard -- step 1 entry", () => {
  test("renders Basics heading and progress step 1 of 5", () => {
    render(<HostExperienceWizard hostIsVerified={true} />);
    // screen.getByText throws if not found, so these lines assert presence.
    expect(screen.getByText("The basics").textContent).toBe("The basics");
    expect(screen.getByText("Step 1 of 5").textContent).toBe("Step 1 of 5");
  });

  test("cannot advance from step 1 without an 8-character title", async () => {
    const user = userEvent.setup();
    render(<HostExperienceWizard hostIsVerified={true} />);
    await user.click(screen.getByRole("button", { name: /save & continue/i }));
    // Still on step 1.
    expect(screen.getByText("Step 1 of 5").textContent).toBe("Step 1 of 5");
  });
});

describe("HostExperienceWizard -- step 5 publish gating", () => {
  test("publish button is enabled when host is verified AND content is valid", () => {
    render(
      <HostExperienceWizard
        hostIsVerified={true}
        initialStep={5}
        initial={validInitial()}
      />,
    );
    const publishButton = screen.getByTestId("publish-button");
    expect(isDisabled(publishButton)).toBe(false);
  });

  test("publish button is disabled when host is NOT verified, even with valid content", () => {
    render(
      <HostExperienceWizard
        hostIsVerified={false}
        initialStep={5}
        initial={validInitial()}
      />,
    );
    const publishButton = screen.getByTestId("publish-button");
    expect(isDisabled(publishButton)).toBe(true);
  });

  test("publish button is disabled when content is invalid, even if host is verified", () => {
    const invalid = validInitial();
    invalid.title = "Short"; // below the 8-char minimum
    render(
      <HostExperienceWizard
        hostIsVerified={true}
        initialStep={5}
        initial={invalid}
      />,
    );
    const publishButton = screen.getByTestId("publish-button");
    expect(isDisabled(publishButton)).toBe(true);
  });

  test("pricing breakdown renders the 80/20 split for the initial price", () => {
    render(
      <HostExperienceWizard
        hostIsVerified={true}
        initialStep={5}
        initial={validInitial()}
      />,
    );
    // computeHostPayout(1_000_000) -> { platformFee: 200_000, hostPayout: 800_000 }.
    // The payout row carries a data-testid so tests do not depend on surrounding copy.
    const payout = screen.getByTestId("host-payout");
    // toLocaleString output on host locales typically renders as "800,000" but
    // some locales use "800.000" -- accept either by stripping non-digits.
    expect(payout.textContent?.replace(/\D+/g, "")).toMatch(/^800000/);
  });

  test("verification-gated publish renders an inline link to /host-setup", () => {
    render(
      <HostExperienceWizard
        hostIsVerified={false}
        initialStep={5}
        initial={validInitial()}
      />,
    );
    const helper = screen.getByRole("link", { name: /open host setup/i });
    expect(helper.getAttribute("href")).toBe("/host-setup");
  });
});

describe("HostExperienceWizard -- pricing currency + math", () => {
  test("displays currency from HOST_TOUR_PRICING (not a hardcoded string)", () => {
    render(
      <HostExperienceWizard
        hostIsVerified={true}
        initialStep={5}
        initial={validInitial()}
      />,
    );
    // `You receive ... VND` row includes the currency constant; locking it in
    // prevents drift with the shared pricing module.
    const payout = screen.getByTestId("host-payout");
    expect(payout.textContent).toContain(HOST_TOUR_PRICING.currency);
  });
});
