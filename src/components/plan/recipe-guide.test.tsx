import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecipeGuide } from "./recipe-guide";

// Lightweight translation stub: return the key namespaced. Lets tests
// assert on key existence without depending on the message catalogues.
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${ns}.${key}(${JSON.stringify(params)})`;
    }
    return `${ns}.${key}`;
  },
  useLocale: () => "vi",
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockRecipesData = {
  recipes: [
    {
      tourId: "TEST_TOUR",
      titleVi: "Tour Thử Nghiệm",
      titleEn: "Test Tour",
      chapter: "MORNING_SHIFT",
      storyScriptVi: "Câu chuyện thử nghiệm.",
      storyScriptEn: "Test story.",
      durationMinutes: 240,
      minParticipants: 2,
      maxParticipants: 6,
      basePriceVnd: 900_000,
      steps: [
        {
          stepId: "step-1",
          stepOrder: 1,
          targetTimeOffset: 0,
          locationNameVi: "Bước 1",
          locationNameEn: "Step 1",
          actionLogVi: "Log VI.",
          actionLogEn: "Log EN.",
          activityId: "atom-1",
          activitySlug: "test-atom-1",
          atomPriceVnd: 300_000,
          atomPhoto: null,
          earliestOpenSlotId: "slot-1",
          earliestSlotStartsAt: new Date().toISOString(),
        },
        {
          stepId: "step-2",
          stepOrder: 2,
          targetTimeOffset: 90,
          locationNameVi: "Bước 2",
          locationNameEn: "Step 2",
          actionLogVi: "Log VI 2.",
          actionLogEn: "Log EN 2.",
          // Unmapped — narrative only.
          activityId: null,
          activitySlug: null,
          atomPriceVnd: null,
          atomPhoto: null,
          earliestOpenSlotId: null,
          earliestSlotStartsAt: null,
        },
      ],
    },
  ],
};

const recipesUseQueryMock = vi.fn(() => ({
  data: mockRecipesData,
  isLoading: false,
}));
const cartAddMutateMock = vi.fn(async () => ({ id: "cart-line-1" }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    fixedTour: {
      recipes: {
        useQuery: () => recipesUseQueryMock(),
      },
    },
    cart: {
      add: {
        useMutation: () => ({
          mutate: vi.fn(),
          mutateAsync: cartAddMutateMock,
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      cart: {
        get: { invalidate: vi.fn() },
        getCount: { invalidate: vi.fn() },
      },
    }),
  },
}));

vi.mock("@/components/cart/add-to-cart-button", () => ({
  AddToCartButton: ({ onAdd, label }: { onAdd: () => Promise<void>; label?: string }) => (
    <button type="button" data-testid="add-to-cart" onClick={() => void onAdd()}>
      {label ?? "Add to cart"}
    </button>
  ),
}));

beforeEach(() => {
  cartAddMutateMock.mockClear();
});

describe("RecipeGuide", () => {
  test("renders the eyebrow + title + solo-nudge banner by default (collapsed)", () => {
    render(<RecipeGuide />);
    expect(screen.getByText("plan.build.recipes.eyebrow")).toBeTruthy();
    expect(screen.getByText("plan.build.recipes.title")).toBeTruthy();
    expect(screen.getByText("plan.build.recipes.soloNudge")).toBeTruthy();
    // Collapsed: recipes list is not rendered.
    expect(screen.queryByText("Tour Thử Nghiệm")).toBeNull();
  });

  test("expands to show recipes when the toggle is clicked", () => {
    render(<RecipeGuide />);
    const toggle = screen.getByRole("button", { name: /expand|collapse/i });
    fireEvent.click(toggle);

    // Recipe title is the bilingual-picked VI title.
    expect(screen.getByText("Tour Thử Nghiệm")).toBeTruthy();
  });

  test("mapped step shows AddToCartButton; unmapped step shows comingSoon", () => {
    render(<RecipeGuide />);
    fireEvent.click(screen.getByRole("button", { name: /expand|collapse/i }));

    // Open the recipe accordion (<details>) by clicking the summary.
    const summary = screen.getByText("Tour Thử Nghiệm").closest("summary");
    expect(summary).toBeTruthy();
    fireEvent.click(summary!);

    // Step 1 has activityId → AddToCartButton renders.
    expect(screen.getByTestId("add-to-cart")).toBeTruthy();

    // Step 2 has no activityId → "comingSoon" badge.
    expect(screen.getByText("plan.build.recipes.comingSoon")).toBeTruthy();
  });

  test("clicking the add button on a mapped step fires cart.add with the resolved slot", async () => {
    render(<RecipeGuide />);
    fireEvent.click(screen.getByRole("button", { name: /expand|collapse/i }));
    const summary = screen.getByText("Tour Thử Nghiệm").closest("summary");
    fireEvent.click(summary!);

    const addBtn = screen.getByTestId("add-to-cart");
    fireEvent.click(addBtn);

    // The mock resolves immediately; check that mutateAsync was called
    // with the expected payload shape.
    expect(cartAddMutateMock).toHaveBeenCalledTimes(1);
    expect(cartAddMutateMock).toHaveBeenCalledWith({
      kind: "activity",
      activityId: "atom-1",
      activitySlotId: "slot-1",
      quantity: 1,
    });
  });

  test("empty recipe list shows an empty-state message", () => {
    // `mockReturnValue` (not `Once`) so every re-render still sees the
    // empty shape -- otherwise the post-click re-render would call the
    // mock a second time and fall through to the default with data.
    recipesUseQueryMock.mockReturnValue({
      data: { recipes: [] },
      isLoading: false,
    });
    render(<RecipeGuide />);
    fireEvent.click(screen.getByRole("button", { name: /expand|collapse/i }));
    expect(screen.getByText("plan.build.recipes.empty")).toBeTruthy();
    // Restore so other tests use the default mock.
    recipesUseQueryMock.mockReturnValue({
      data: mockRecipesData,
      isLoading: false,
    });
  });
});
