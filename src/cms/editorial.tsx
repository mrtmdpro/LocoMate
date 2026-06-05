import React from "react";

export type EditorialCollection = "articles" | "guides" | "legalPages";
export type EditorialLocale = "en" | "vi";

export type EditorialDoc = {
  body?: LexicalRichText | null;
  excerpt?: string | null;
  heroImage?: { alt?: string | null; url?: string | null } | string | null;
  publishedAt?: Date | string | null;
  slug: string;
  title?: string | null;
};

export function isEditorialLocale(locale: string): locale is EditorialLocale {
  return locale === "en" || locale === "vi";
}

type PayloadFindArgs = {
  collection: EditorialCollection;
  depth?: number;
  draft?: boolean;
  fallbackLocale?: EditorialLocale;
  limit?: number;
  locale?: EditorialLocale;
  pagination?: boolean;
  sort?: string;
  where?: Record<string, unknown>;
};

type PayloadLike = {
  find: unknown;
};

export async function getPublishedEditorialBySlug<TDoc>(
  payload: PayloadLike,
  input: {
    collection: EditorialCollection;
    locale: EditorialLocale;
    slug: string;
  },
): Promise<TDoc | null> {
  const find = payload.find as (args: PayloadFindArgs) => Promise<{ docs?: unknown[] }>;
  const result = await find({
    collection: input.collection,
    depth: 2,
    draft: false,
    fallbackLocale: "en",
    limit: 1,
    locale: input.locale,
    pagination: false,
    where: {
      and: [
        { slug: { equals: input.slug } },
        { _status: { equals: "published" } },
      ],
    },
  });

  return (result.docs?.[0] as TDoc | undefined) ?? null;
}

export async function listPublishedEditorial<TDoc>(
  payload: PayloadLike,
  input: {
    collection: EditorialCollection;
    locale: EditorialLocale;
    limit?: number;
  },
): Promise<TDoc[]> {
  const find = payload.find as (args: PayloadFindArgs) => Promise<{ docs?: unknown[] }>;
  const result = await find({
    collection: input.collection,
    depth: 1,
    draft: false,
    fallbackLocale: "en",
    limit: input.limit ?? 12,
    locale: input.locale,
    sort: "-publishedAt",
    where: { _status: { equals: "published" } },
  });

  return (result.docs ?? []) as TDoc[];
}

type LexicalTextNode = {
  text?: string;
  format?: number;
};

type LexicalElementNode = {
  children?: LexicalNode[];
  tag?: string;
  type?: string;
};

type LexicalNode = LexicalTextNode | LexicalElementNode;

export type LexicalRichText = {
  root?: {
    children?: LexicalNode[];
  };
};

export function renderLexicalRichText(value: LexicalRichText | null | undefined): React.ReactNode {
  const children = value?.root?.children ?? [];
  return (
    <div className="space-y-4">
      {children.map((node, index) => renderLexicalNode(node, index))}
    </div>
  );
}

function renderLexicalNode(node: LexicalNode, key: React.Key): React.ReactNode {
  if ("text" in node) {
    return renderTextNode(node, key);
  }

  const element = node as LexicalElementNode;

  if (element.type === "heading") {
    const content = renderChildren(element.children);
    if (element.tag === "h2") {
      return (
        <h2 key={key} className="font-serif text-3xl text-secondary">
          {content}
        </h2>
      );
    }
    return (
      <h3 key={key} className="font-serif text-2xl text-secondary">
        {content}
      </h3>
    );
  }

  if (element.type === "paragraph") {
    return (
      <p key={key} className="text-base leading-7 text-foreground/80">
        {renderChildren(element.children)}
      </p>
    );
  }

  if (element.type === "list") {
    return (
      <ul key={key} className="list-disc space-y-2 pl-5 text-base leading-7 text-foreground/80">
        {renderChildren(element.children)}
      </ul>
    );
  }

  if (element.type === "listitem") {
    return <li key={key}>{renderChildren(element.children)}</li>;
  }

  return null;
}

function renderChildren(children: LexicalNode[] | undefined): React.ReactNode {
  return children?.map((child, index) => renderLexicalNode(child, index)) ?? null;
}

function renderTextNode(node: LexicalTextNode, key: React.Key): React.ReactNode {
  const text = node.text ?? "";
  const isBold = !!(node.format && (node.format & 1) === 1);

  if (isBold) {
    return <strong key={key}>{text}</strong>;
  }

  return <React.Fragment key={key}>{text}</React.Fragment>;
}
