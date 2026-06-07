import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  getPublishedEditorialBySlug,
  listPublishedEditorial,
  renderLexicalRichText,
} from "./editorial";

describe("editorial CMS helpers", () => {
  it("fetches one published localized document by slug", async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 1, slug: "old-quarter", title: "Old Quarter" }],
    });

    const doc = await getPublishedEditorialBySlug(
      { find },
      { collection: "articles", locale: "vi", slug: "old-quarter" },
    );

    expect(doc).toEqual({ id: 1, slug: "old-quarter", title: "Old Quarter" });
    expect(find).toHaveBeenCalledWith({
      collection: "articles",
      depth: 2,
      draft: false,
      fallbackLocale: "en",
      limit: 1,
      locale: "vi",
      pagination: false,
      where: {
        and: [
          { slug: { equals: "old-quarter" } },
          { _status: { equals: "published" } },
        ],
      },
    });
  });

  it("returns null when a localized published document is missing", async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] });

    const doc = await getPublishedEditorialBySlug(
      { find },
      { collection: "legalPages", locale: "en", slug: "privacy" },
    );

    expect(doc).toBeNull();
  });

  it("does not request draft content for public detail pages", async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] });

    await getPublishedEditorialBySlug(
      { find },
      { collection: "articles", locale: "en", slug: "draft-story" },
    );

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: false,
        where: {
          and: [
            { slug: { equals: "draft-story" } },
            { _status: { equals: "published" } },
          ],
        },
      }),
    );
  });

  it("lists published localized documents newest first", async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ slug: "a" }, { slug: "b" }],
    });

    const docs = await listPublishedEditorial(
      { find },
      { collection: "guides", locale: "vi", limit: 6 },
    );

    expect(docs).toEqual([{ slug: "a" }, { slug: "b" }]);
    expect(find).toHaveBeenCalledWith({
      collection: "guides",
      depth: 1,
      draft: false,
      fallbackLocale: "en",
      limit: 6,
      locale: "vi",
      sort: "-publishedAt",
      where: { _status: { equals: "published" } },
    });
  });

  it("renders basic Lexical rich text blocks without exposing unknown nodes", () => {
    const html = renderToStaticMarkup(
      renderLexicalRichText({
        root: {
          children: [
            {
              type: "heading",
              tag: "h2",
              children: [{ text: "Hanoi guide" }],
            },
            {
              type: "paragraph",
              children: [
                { text: "Eat " },
                { text: "bun cha", format: 1 },
                { text: " before noon." },
              ],
            },
            {
              type: "unknown-widget",
              children: [{ text: "should not render" }],
            },
          ],
        },
      }),
    );

    expect(html).toContain("<h2");
    expect(html).toContain("Hanoi guide");
    expect(html).toContain("<p");
    expect(html).toContain("<strong>bun cha</strong>");
    expect(html).not.toContain("should not render");
  });
});
