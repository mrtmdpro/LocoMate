import Image from "next/image";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  type EditorialCollection,
  type EditorialDoc,
  type EditorialLocale,
  getPublishedEditorialBySlug,
  listPublishedEditorial,
  renderLexicalRichText,
} from "./editorial";
import { getCmsPayload } from "./payload";

type CollectionLabels = {
  description: string;
  eyebrow: string;
  href: string;
  title: string;
};

const labelsByCollection: Record<EditorialCollection, CollectionLabels> = {
  articles: {
    description: "Dispatches, city notes, and product updates from LOCOMATE.",
    eyebrow: "Journal",
    href: "/blog",
    title: "Blog",
  },
  guides: {
    description: "Practical Hanoi guides written for slower, more curious travel.",
    eyebrow: "Guides",
    href: "/guides",
    title: "Guides",
  },
  legalPages: {
    description: "Policies and notices that explain how LOCOMATE works.",
    eyebrow: "Legal",
    href: "/legal",
    title: "Legal",
  },
};

export async function EditorialListPage({
  collection,
  locale,
}: {
  collection: EditorialCollection;
  locale: EditorialLocale;
}) {
  const docs = await safeListPublishedEditorial({
    collection,
    locale,
    limit: 24,
  });
  const labels = labelsByCollection[collection];

  return (
    <main className="px-4 py-8 lg:mx-auto lg:max-w-5xl lg:px-8">
      <section className="mb-8 rounded-[2rem] bg-card p-6 shadow-sm border border-foreground/10">
        <p className="text-eyebrow text-primary">{labels.eyebrow}</p>
        <h1 className="mt-2 font-serif text-4xl text-secondary">{labels.title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {labels.description}
        </p>
      </section>

      {docs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-foreground/15 bg-muted/30 p-8 text-center">
          <p className="font-medium text-foreground">No published content yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Drafts stay hidden until an editor publishes them in the CMS.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {docs.map((doc) => (
            <Link
              key={doc.slug}
              href={`${labels.href}/${doc.slug}`}
              className="group rounded-3xl border border-foreground/10 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <HeroImage doc={doc} sizes="(min-width: 1024px) 30vw, 92vw" />
              <p className="mt-4 text-eyebrow text-primary">{formatDate(doc.publishedAt)}</p>
              <h2 className="mt-1 font-serif text-2xl text-secondary group-hover:text-primary">
                {doc.title ?? doc.slug}
              </h2>
              {doc.excerpt && (
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {doc.excerpt}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export async function EditorialDetailPage({
  collection,
  locale,
  slug,
}: {
  collection: EditorialCollection;
  locale: EditorialLocale;
  slug: string;
}) {
  const doc = await safeGetPublishedEditorialBySlug({
    collection,
    locale,
    slug,
  });

  if (!doc) {
    notFound();
  }

  const labels = labelsByCollection[collection];

  return (
    <main className="px-4 py-8 lg:mx-auto lg:max-w-3xl lg:px-8">
      <Link href={labels.href} className="text-sm font-semibold text-primary hover:underline">
        Back to {labels.title}
      </Link>
      <article className="mt-5 rounded-[2rem] bg-card p-5 shadow-sm border border-foreground/10 lg:p-8">
        <p className="text-eyebrow text-primary">{labels.eyebrow}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-secondary lg:text-5xl">
          {doc.title ?? doc.slug}
        </h1>
        {doc.excerpt && (
          <p className="mt-4 text-lg leading-8 text-muted-foreground">{doc.excerpt}</p>
        )}
        <div className="mt-6">
          <HeroImage doc={doc} sizes="(min-width: 1024px) 736px, 92vw" priority />
        </div>
        <div className="mt-8">{renderLexicalRichText(doc.body)}</div>
      </article>
    </main>
  );
}

async function safeListPublishedEditorial(input: {
  collection: EditorialCollection;
  locale: EditorialLocale;
  limit: number;
}): Promise<EditorialDoc[]> {
  try {
    const payload = await getCmsPayload();
    return listPublishedEditorial<EditorialDoc>(payload, input);
  } catch (error) {
    console.error("CMS list failed", { collection: input.collection, error });
    return [];
  }
}

async function safeGetPublishedEditorialBySlug(input: {
  collection: EditorialCollection;
  locale: EditorialLocale;
  slug: string;
}): Promise<EditorialDoc | null> {
  try {
    const payload = await getCmsPayload();
    return getPublishedEditorialBySlug<EditorialDoc>(payload, input);
  } catch (error) {
    console.error("CMS detail failed", {
      collection: input.collection,
      error,
      slug: input.slug,
    });
    return null;
  }
}

function HeroImage({
  doc,
  priority = false,
  sizes,
}: {
  doc: EditorialDoc;
  priority?: boolean;
  sizes: string;
}) {
  const image = getHeroImage(doc);
  if (!image?.url) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-2xl bg-muted text-sm text-muted-foreground">
        LOCOMATE
      </div>
    );
  }

  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-muted">
      <Image
        src={image.url}
        alt={image.alt ?? ""}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}

function getHeroImage(doc: EditorialDoc): { alt?: string | null; url?: string | null } | null {
  if (!doc.heroImage || typeof doc.heroImage === "string") {
    return null;
  }

  return doc.heroImage;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return "Published";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
