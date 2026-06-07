import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  decimal,
  time,
  uniqueIndex,
  index,
  doublePrecision,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).unique().notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    role: varchar("role", { length: 20 }).notNull().default("traveler"),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    phone: varchar("phone", { length: 20 }),
    phoneVerified: boolean("phone_verified").default(false),
    emailVerified: boolean("email_verified").default(false),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_users_email").on(table.email),
    index("idx_users_role").on(table.role),
  ]
);

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .unique()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  explicitData: jsonb("explicit_data").default({}).notNull(),
  derivedData: jsonb("derived_data").default({}).notNull(),
  implicitData: jsonb("implicit_data").default({}).notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  derivedUpdatedAt: timestamp("derived_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const hostProfiles = pgTable(
  "host_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .unique()
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // URL slug for the public host profile page (`/hosts/:publicSlug`).
    // Nullable so migrations can land without backfilling every row in the
    // same commit; the generation helper in `slugify.ts` guarantees
    // uniqueness within the table at host-approval time.
    publicSlug: varchar("public_slug", { length: 80 }),
    bio: varchar("bio", { length: 300 }),
    bioVi: varchar("bio_vi", { length: 300 }),
    bioEn: varchar("bio_en", { length: 300 }),
    languages: jsonb("languages").default([]).notNull(),
    specialties: text("specialties").array().default([]),
    identityDocUrl: varchar("identity_doc_url", { length: 500 }),
    verificationStatus: varchar("verification_status", { length: 20 }).default("pending"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    avgRating: decimal("avg_rating", { precision: 3, scale: 2 }).default("0.00"),
    totalReviews: integer("total_reviews").default(0),
    totalTours: integer("total_tours").default(0),
    isAvailable: boolean("is_available").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_host_verification").on(table.verificationStatus),
    index("idx_host_available").on(table.isAvailable),
    // Partial unique (WHERE NOT NULL) so the many slug-less rows don't collide,
    // matching the real DDL in scripts/create-host-profile-slugs.ts.
    uniqueIndex("host_profiles_public_slug_key")
      .on(table.publicSlug)
      .where(sql`public_slug IS NOT NULL`),
  ]
);

// Saved hosts -- travelers can favorite hosts from their profile page.
// Mirrors `saved_places`; a unique (userId, hostId) pair prevents duplicates.
export const savedHosts = pgTable(
  "saved_hosts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    hostId: uuid("host_id")
      .references(() => hostProfiles.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_saved_hosts_user_host").on(table.userId, table.hostId),
    index("idx_saved_hosts_user").on(table.userId),
  ]
);

export const hostAvailability = pgTable("host_availability", {
  id: uuid("id").defaultRandom().primaryKey(),
  hostId: uuid("host_id")
    .references(() => hostProfiles.id, { onDelete: "cascade" })
    .notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isActive: boolean("is_active").default(true),
});

export const places = pgTable(
  "places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    nameVi: varchar("name_vi", { length: 200 }),
    nameEn: varchar("name_en", { length: 200 }),
    slug: varchar("slug", { length: 250 }).unique(),
    description: varchar("description", { length: 500 }),
    descriptionVi: varchar("description_vi", { length: 500 }),
    descriptionEn: varchar("description_en", { length: 500 }),
    category: varchar("category", { length: 50 }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    address: varchar("address", { length: 300 }),
    photos: text("photos").array().default([]),
    openingHours: jsonb("opening_hours"),
    priceRange: varchar("price_range", { length: 20 }),
    experienceTags: jsonb("experience_tags").default({}).notNull(),
    emotionalTags: jsonb("emotional_tags").default({}).notNull(),
    source: varchar("source", { length: 30 }).default("system_seeded"),
    isVerified: boolean("is_verified").default(false),
    isActive: boolean("is_active").default(true),
    contributedBy: uuid("contributed_by").references(() => users.id),
    avgRating: decimal("avg_rating", { precision: 3, scale: 2 }).default("0.00"),
    totalReviews: integer("total_reviews").default(0),
    visitCount: integer("visit_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_places_category").on(table.category),
    index("idx_places_active").on(table.isActive, table.isVerified),
    index("idx_places_geo").on(table.latitude, table.longitude),
  ]
);

/* ────────────────────────────────────────────────────────────────────────
 *  BILINGUAL CONTENT PATTERN (Option A — dedicated `_vi` / `_en` columns)
 *
 *  Customer-visible content tables carry a triple of columns for every
 *  user-facing text field:
 *
 *      <field>      — legacy single-language column, kept for backwards
 *                     compatibility and as a last-resort fallback. Existing
 *                     host-authored rows keep writing here.
 *      <field>_vi   — Vietnamese translation. NULLABLE: partial coverage
 *                     is allowed (host wizard may write only one language).
 *      <field>_en   — English translation. NULLABLE for the same reason.
 *
 *  The UI picks the right field via `pickLocaleField(row, "title", locale)`
 *  which falls back through (locale-specific → other locale → legacy).
 *
 *  Tables on this pattern (DDL lives in scripts/create-bilingual-columns.ts):
 *    experiences   — title, subtitle, description, highlights, included, schedule
 *    places        — name, description   (address skipped)
 *    activities    — title, subtitle, description, highlights, included, requirements
 *    products      — title, subtitle, description
 *    host_profiles — bio
 *
 *  The curated Fixed Tour catalog (`fixed_tours`, `fixed_tour_steps`) was
 *  bilingual from day one and uses NOT NULL `_vi` / `_en` columns instead.
 * ──────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────
 *  FIXED TOUR CATALOG (chapter-organized, bilingual, vector-matched)
 *
 *  The team's spec at `docs/sửa .md` introduces a 15-tour curated catalog
 *  for fixed tours. Three tables back the catalog:
 *
 *    fixed_tours       — one row per tour: bilingual title + story, the
 *                        time-of-day chapter, base price, and a 4-D
 *                        personality vector that the cosine matcher
 *                        ranks against the user's quiz result.
 *    fixed_tour_steps  — itinerary stops, lat/long + minute-offset from
 *                        start, with bilingual action logs. Replaces
 *                        `experiences.schedule` (jsonb) for the curated
 *                        catalog. Host listings keep their inline jsonb
 *                        schedule unchanged.
 *    fixed_tour_tags   — multi-class taxonomy. `MATERIAL` carries the
 *                        old 3 themes (heritage / craft / food) as
 *                        #-prefixed slugs; `PERSONA` carries the 4
 *                        personality axes; `KEYWORD` is free-form
 *                        search bait (e.g. "Sunrise", "Phở_Culture").
 *
 *  The `tours` table gains a nullable `fixed_tour_id` next to its
 *  existing `experience_id`. At most one of the two is set per booking
 *  (DB CHECK constraint lives in scripts/create-fixed-tour-tables.ts);
 *  algorithmic tours from /plan/build set neither.
 * ──────────────────────────────────────────────────────────────────── */

export const experiences = pgTable(
  "experiences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    titleVi: varchar("title_vi", { length: 200 }),
    titleEn: varchar("title_en", { length: 200 }),
    slug: varchar("slug", { length: 250 }).unique(),
    subtitle: varchar("subtitle", { length: 300 }),
    subtitleVi: varchar("subtitle_vi", { length: 300 }),
    subtitleEn: varchar("subtitle_en", { length: 300 }),
    description: text("description"),
    descriptionVi: text("description_vi"),
    descriptionEn: text("description_en"),
    category: varchar("category", { length: 50 }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceAmount: integer("price_amount").notNull(),
    maxGroupSize: integer("max_group_size").default(4),
    photos: text("photos").array().default([]),
    highlights: jsonb("highlights").default([]),
    highlightsVi: jsonb("highlights_vi"),
    highlightsEn: jsonb("highlights_en"),
    included: jsonb("included").default([]),
    includedVi: jsonb("included_vi"),
    includedEn: jsonb("included_en"),
    schedule: jsonb("schedule").default([]),
    scheduleVi: jsonb("schedule_vi"),
    scheduleEn: jsonb("schedule_en"),
    hostRequired: boolean("host_required").default(true),
    isActive: boolean("is_active").default(true),
    avgRating: decimal("avg_rating", { precision: 3, scale: 2 }).default("0.00"),
    totalBookings: integer("total_bookings").default(0),
    // Marketplace columns. `authorId` is null for LOCOMATE-curated listings
    // and set for host-authored ones. `kind` drives the segmented filter on
    // the listing page. `status` drives the moderation lifecycle (auto-publish
    // for verified hosts; the `rejected` slot is reserved for future takedown
    // tooling).
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    kind: varchar("kind", { length: 20 }).notNull().default("curated"),
    status: varchar("status", { length: 20 }).notNull().default("published"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_experiences_author").on(table.authorId),
    index("idx_experiences_public").on(table.status, table.kind),
  ]
);

/**
 * Curated Fixed Tour catalog. The 15-tour content from docs/sửa .md is
 * keyed by a human-readable `tour_id` like `LOCO_FT_M1` instead of a UUID
 * so logs and URLs stay legible (`/fixed-tours/LOCO_FT_M1`).
 *
 * `chapter` is one of `MORNING_SHIFT` / `AFTERNOON_SHIFT` / `EVENING_SHIFT`.
 * Stored as varchar to match the codebase convention (the existing
 * `experiences.status`, `tours.status`, etc. all use varchar + comment
 * rather than pgEnum); a Postgres CHECK and a Zod enum at the API
 * boundary enforce the allowed values.
 *
 * `vector` is a JSON-encoded 4-float array
 * `[Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living]`
 * — the input space for `lib/cosine.rankByCosine`.
 */
export const fixedTours = pgTable(
  "fixed_tours",
  {
    tourId: varchar("tour_id", { length: 30 }).primaryKey(),
    titleVi: varchar("title_vi", { length: 255 }).notNull(),
    titleEn: varchar("title_en", { length: 255 }).notNull(),
    chapter: varchar("chapter", { length: 20 }).notNull(),
    storyScriptVi: text("story_script_vi").notNull(),
    storyScriptEn: text("story_script_en").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(240),
    maxParticipants: integer("max_participants").notNull().default(6),
    // `min_participants` enforces the "Fixed Tour needs at least N people"
    // rule. Default = 2 so the Customized Tour can honestly be marketed as
    // the solo path. The router (`fixedTour.book`) rejects bookings below
    // this; the UI clamps its participant stepper here too.
    minParticipants: integer("min_participants").notNull().default(2),
    basePriceVnd: integer("base_price_vnd").notNull(),
    vector: jsonb("vector").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_fixed_tours_chapter").on(table.chapter),
    index("idx_fixed_tours_active").on(table.isActive),
  ]
);

/**
 * Per-stop itinerary for the curated catalog. Replaces the jsonb
 * `experiences.schedule` for fixed tours, adding lat/long for map pins
 * and minute offsets for ETA math. Lat/long are NULLable so a tour can
 * ship with steps before the geo is hand-curated.
 */
export const fixedTourSteps = pgTable(
  "fixed_tour_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tourId: varchar("tour_id", { length: 30 })
      .references(() => fixedTours.tourId, { onDelete: "cascade" })
      .notNull(),
    stepOrder: integer("step_order").notNull(),
    targetTimeOffset: integer("target_time_offset").notNull(),
    locationNameVi: varchar("location_name_vi", { length: 255 }).notNull(),
    locationNameEn: varchar("location_name_en", { length: 255 }).notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    actionLogVi: text("action_log_vi").notNull(),
    actionLogEn: text("action_log_en").notNull(),
    // Optional FK to the standalone `activities` row that lets travelers
    // book this step individually (the "atom" model). The lazy lambda
    // form avoids a circular declaration with `activities` defined later
    // in this file; the explicit `AnyPgColumn` return type breaks the
    // recursive TS-inference loop that the bidirectional FK would
    // otherwise cause. ON DELETE SET NULL because deleting an atom
    // shouldn't wipe the curated step narrative.
    activityId: uuid("activity_id").references((): AnyPgColumn => activities.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("idx_fixed_tour_steps_unique").on(table.tourId, table.stepOrder),
    index("idx_fixed_tour_steps_tour").on(table.tourId),
    index("idx_fixed_tour_steps_activity").on(table.activityId),
  ]
);

/**
 * Multi-class taxonomy. A single tour can carry many MATERIAL, PERSONA,
 * and KEYWORD tags. Used by the list filter (`?materials=#HuongMen`),
 * by the wrap-up letter generator (chapter + MATERIAL drive copy), and
 * (longer term) by a free-text search if we want one.
 */
export const fixedTourTags = pgTable(
  "fixed_tour_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tourId: varchar("tour_id", { length: 30 })
      .references(() => fixedTours.tourId, { onDelete: "cascade" })
      .notNull(),
    tagClass: varchar("tag_class", { length: 20 }).notNull(),
    tagKey: varchar("tag_key", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_fixed_tour_tags_lookup").on(table.tagClass, table.tagKey),
    index("idx_fixed_tour_tags_tour").on(table.tourId),
  ]
);

/**
 * Customized Tour Template Matrix.
 *
 * Parallel to `fixedTours` but for the *flexible* product line. Each row
 * is a curated **inspiration template** — a themed day plan with a story
 * and a 4-D personality vector — that the traveler uses as a starting
 * point on `/plan/build`. Unlike Fixed Tours which book end-to-end with
 * a Bạn Lối guide and a fixed price, customized templates feed into the
 * activity-cart day-builder: a "Start from this" CTA on the template
 * detail page seeds the cart with theme-appropriate activities, and the
 * traveler edits the resulting day to taste before checkout.
 *
 * Vector layout matches `fixedTours.vector`:
 * `[Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living]`.
 * Same `lib/cosine.rankByCosine` ranks both catalogs against the user's
 * `user_profiles.derivedData.personalityVector`.
 *
 * `theme` is a free-form short label (e.g. "foodie", "heritage", "craft",
 * "quiet", "balanced") used for filtering and visual grouping; not a
 * Postgres enum because we expect the brand voice to add new themes
 * without a schema migration.
 *
 * `basePriceVnd` is an *estimated* bundle price for display only — the
 * real booked price comes from whatever activities the traveler picks.
 */
export const customizedTourTemplates = pgTable(
  "customized_tour_templates",
  {
    templateId: varchar("template_id", { length: 30 }).primaryKey(),
    titleVi: varchar("title_vi", { length: 255 }).notNull(),
    titleEn: varchar("title_en", { length: 255 }).notNull(),
    subtitleVi: varchar("subtitle_vi", { length: 500 }),
    subtitleEn: varchar("subtitle_en", { length: 500 }),
    theme: varchar("theme", { length: 30 }).notNull(),
    storyVi: text("story_vi").notNull(),
    storyEn: text("story_en").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(360),
    maxParticipants: integer("max_participants").notNull().default(4),
    basePriceVnd: integer("base_price_vnd").notNull(),
    vector: jsonb("vector").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_customized_tour_templates_theme").on(table.theme),
    index("idx_customized_tour_templates_active").on(table.isActive),
  ]
);

export const savedPlaces = pgTable(
  "saved_places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    placeId: uuid("place_id")
      .references(() => places.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_saved_places_user_place").on(table.userId, table.placeId),
    index("idx_saved_places_user").on(table.userId),
  ]
);

// A "match" pair-keys two users who can message each other. Participants
// are NULLable because when a user deletes their account we SET their side
// NULL and tombstone their messages (see user.deleteAccount + the retention
// cron) so the survivor's conversation history stays intact. Queries that
// need "the other user" must defensively handle NULL.
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userAId: uuid("user_a_id").references(() => users.id, { onDelete: "set null" }),
    userBId: uuid("user_b_id").references(() => users.id, { onDelete: "set null" }),
    score: decimal("score", { precision: 5, scale: 4 }).notNull(),
    status: varchar("status", { length: 20 }).default("pending"),
    matchedAt: timestamp("matched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_matches_pair").on(table.userAId, table.userBId),
    index("idx_matches_status").on(table.status),
  ]
);

export const swipeActions = pgTable(
  "swipe_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    swiperId: uuid("swiper_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    targetId: uuid("target_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    action: varchar("action", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("idx_swipes_unique").on(table.swiperId, table.targetId)]
);

// Chat messages. Supports soft-edit (editedAt), soft-delete (deletedAt +
// deletedReason, used for user unsend AND account-deletion tombstone),
// optional image attachments (attachmentUrl + kind), and a moderation
// flag so reported content is filterable without losing audit trail.
//
// Retention: the daily cron at /api/cron/purge-messages hard-deletes rows
// with createdAt older than 30 days. See services/purge-messages.ts.
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .references(() => matches.id, { onDelete: "cascade" })
      .notNull(),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    messageType: varchar("message_type", { length: 20 }).default("text"),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    // Soft-edit: editedAt is bumped by chat.editMessage inside a 15-min window.
    editedAt: timestamp("edited_at", { withTimezone: true }),
    // Soft-delete: set by chat.deleteMessage (24h unsend window) or by the
    // account-deletion tombstoning path. `deletedReason` distinguishes the
    // two for audits: 'user_unsent' | 'sender_account_deleted' | 'admin'.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedReason: varchar("deleted_reason", { length: 30 }),
    // Attachments. attachmentKind is 'image' for v1; reserving the column
    // so future kinds (file, location) can extend without an ALTER.
    attachmentUrl: text("attachment_url"),
    attachmentKind: varchar("attachment_kind", { length: 20 }),
    // Moderation. `flagged` is flipped to true by reportMessage or the
    // OpenAI moderation post-response hook; `flagReason` stores the
    // triggering category.
    flagged: boolean("flagged").notNull().default(false),
    flagReason: varchar("flag_reason", { length: 40 }),
  },
  (table) => [
    index("idx_messages_match").on(table.matchId, table.createdAt),
    index("idx_messages_created").on(table.createdAt),
  ]
);

// Emoji reactions. One row per (message, user, emoji); UNIQUE handles
// toggle-off-by-re-click idempotency. Cap of 3 distinct emojis per user
// per message enforced in the addReaction mutation, not DB.
export const messageReactions = pgTable(
  "message_reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: varchar("emoji", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_message_reactions_uniq").on(table.messageId, table.userId, table.emoji),
    index("idx_message_reactions_message").on(table.messageId),
  ]
);

// Trust & safety queue. A traveler or host clicks "Report" on a message;
// we persist the reason, flip messages.flagged = true, and the admin
// /admin/flagged page lists open reports for review.
export const messageReports = pgTable(
  "message_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 40 }).notNull(),
    notes: text("notes"),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_message_reports_status").on(table.status, table.createdAt)]
);

// Mutual block. A blocker cannot see or be seen by the blocked user in
// chat OR in browse surfaces (hosts directory, experience authors).
// Enforced client + server. Symmetric: if A blocks B, neither can message
// the other, and both sides' inbox hides the match.
export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_user_blocks_pk").on(table.blockerId, table.blockedId),
    index("idx_user_blocks_blocked").on(table.blockedId),
  ]
);

export const tours = pgTable(
  "tours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    hostId: uuid("host_id").references(() => hostProfiles.id),
    // Non-null when the tour was booked from a template in `experiences`.
    // ON DELETE SET NULL so deleting a template never cascades into tour
    // history; we want payment + visit records to survive template changes.
    experienceId: uuid("experience_id").references(() => experiences.id, { onDelete: "set null" }),
    // Non-null when the tour was booked from the curated catalog in
    // `fixed_tours`. At most one of `experienceId` / `fixedTourId` is set
    // per row (CHECK constraint lives in scripts/create-fixed-tour-tables.ts).
    // Algorithmic tours from /plan/build leave both null.
    fixedTourId: varchar("fixed_tour_id", { length: 30 }).references(
      () => fixedTours.tourId,
      { onDelete: "set null" },
    ),
    // Crossover Matching columns (see scripts/create-crossover-matching-tables.ts).
    // `originalFixedTourId` is set when migrateToCustom clones a Fixed Tour
    // into a Custom one; it preserves the lineage so analytics can ask
    // "how many migrations came from each catalog template?".
    originalFixedTourId: varchar("original_fixed_tour_id", { length: 30 }).references(
      () => fixedTours.tourId,
      { onDelete: "set null" },
    ),
    // Set on both halves when two tours cross over and lock a shared
    // itinerary. UNIQUE partial index (where not null) enforces the
    // 1:1 pairing at the DB level.
    crossoverPairId: uuid("crossover_pair_id").references(
      (): AnyPgColumn => tours.id,
      { onDelete: "set null" },
    ),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    // 'system_t24h' | 'user_cancel' | 'escrow_failed' | future codes.
    // varchar + comment per codebase convention; values enforced at the
    // router layer.
    cancelReason: varchar("cancel_reason", { length: 40 }),
    status: varchar("status", { length: 20 }).default("draft"),
    requestParams: jsonb("request_params").notNull(),
    tourData: jsonb("tour_data"),
    packageType: varchar("package_type", { length: 20 }).notNull(),
    priceAmount: integer("price_amount").default(0).notNull(),
    priceCurrency: varchar("price_currency", { length: 3 }).default("VND"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_tours_user").on(table.userId, table.status),
    index("idx_tours_status").on(table.status),
    index("idx_tours_experience").on(table.experienceId),
    index("idx_tours_fixed_tour").on(table.fixedTourId),
    index("idx_tours_original_fixed_tour").on(table.originalFixedTourId),
    // 1:1 crossover pairing — only one tour may point at a given partner.
    // Partial so the (common) null rows don't collide.
    uniqueIndex("idx_tours_crossover_pair")
      .on(table.crossoverPairId)
      .where(sql`crossover_pair_id IS NOT NULL`),
  ]
);

export const tourStops = pgTable(
  "tour_stops",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tourId: uuid("tour_id")
      .references(() => tours.id, { onDelete: "cascade" })
      .notNull(),
    placeId: uuid("place_id").references(() => places.id),
    stopOrder: integer("stop_order").notNull(),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
    durationMinutes: integer("duration_minutes").notNull(),
    notes: varchar("notes", { length: 500 }),
    visitedAt: timestamp("visited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_tour_stops_tour").on(table.tourId, table.stopOrder)]
);

/* ────────────────────────────────────────────────────────────────────
 *  CROSSOVER MATCHING (capacity rescue + AI matchmaking + Δ-payment)
 *
 *  See `docs/fixed-tour-feature.md` and the DDL script at
 *  `scripts/create-crossover-matching-tables.ts` for the lifecycle.
 *  Each Fixed Tour with `currentCapacity < 2` at T-48h triggers a
 *  rescue flow that can either migrate to a Custom tour, broadcast a
 *  discovery feed at T-36h, negotiate a shared itinerary in chat by
 *  T-28h, settle a Δ-payment by T-24h, or auto-cancel + refund.
 *
 *  Status values are documented at each column. None of the procedure
 *  status enums are CHECK-constrained in Drizzle — the underlying DDL
 *  script holds the CHECK constraints; Drizzle is a typing surface.
 * ────────────────────────────────────────────────────────────────── */

export const tourCrossoverRequests = pgTable(
  "tour_crossover_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tourId: uuid("tour_id")
      .references(() => tours.id, { onDelete: "cascade" })
      .notNull(),
    requesterUserId: uuid("requester_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    targetTourId: uuid("target_tour_id")
      .references(() => tours.id, { onDelete: "cascade" })
      .notNull(),
    targetUserId: uuid("target_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** 'pending' | 'matched' | 'expired' | 'terminated' */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    matchedAt: timestamp("matched_at", { withTimezone: true }),
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
    terminatedReason: varchar("terminated_reason", { length: 40 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_crossover_requests_tour").on(table.tourId, table.status),
    index("idx_crossover_requests_requester").on(table.requesterUserId, table.status),
    index("idx_crossover_requests_target").on(table.targetUserId, table.status),
    // At most one PENDING request per (requester, target tour). A second
    // duplicate-pending insert collides here instead of racing.
    uniqueIndex("uq_crossover_requests_pending")
      .on(table.requesterUserId, table.targetTourId)
      .where(sql`status = 'pending'`),
  ]
);

/**
 * Smart Proposal Hub edit log. The partial unique index in the DDL
 * (`WHERE status='pending_approval'`) enforces sequential approval:
 * only one open proposal per request at a time. `edit_order` is
 * checked to be 1..3 — three is the spec's hard cap.
 */
export const tourProposalEdits = pgTable(
  "tour_proposal_edits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    crossoverRequestId: uuid("crossover_request_id")
      .references(() => tourCrossoverRequests.id, { onDelete: "cascade" })
      .notNull(),
    proposerUserId: uuid("proposer_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    editOrder: integer("edit_order").notNull(),
    /** 'add' | 'remove' */
    editKind: varchar("edit_kind", { length: 10 }).notNull(),
    targetActivityId: uuid("target_activity_id").references(() => activities.id, {
      onDelete: "set null",
    }),
    /** 'pending_approval' | 'approved' | 'rejected' */
    status: varchar("status", { length: 20 }).notNull().default("pending_approval"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_proposal_edits_one_pending")
      .on(table.crossoverRequestId)
      .where(sql`status = 'pending_approval'`),
    index("idx_proposal_edits_request").on(table.crossoverRequestId, table.editOrder),
  ]
);

/**
 * Δ = cost_new − cost_old. `delta` is a Postgres GENERATED column at
 * the DDL layer — Drizzle reads it as a normal integer field; never
 * try to INSERT a value for it (the DB will reject).
 */
export const escrowAdjustments = pgTable(
  "escrow_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tourId: uuid("tour_id")
      .references(() => tours.id, { onDelete: "cascade" })
      .notNull(),
    crossoverRequestId: uuid("crossover_request_id")
      .references(() => tourCrossoverRequests.id, { onDelete: "cascade" })
      .notNull(),
    costOld: integer("cost_old").notNull(),
    costNew: integer("cost_new").notNull(),
    /** GENERATED ALWAYS AS (cost_new - cost_old) STORED. Read-only in INSERTs. */
    delta: integer("delta").generatedAlwaysAs(sql`cost_new - cost_old`),
    /** 'pending' | 'confirmed' | 'refunded' | 'failed' */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** Stripe Payment Intent ref reserved for Phase C. Null in mock mode. */
    paymentIntentRef: varchar("payment_intent_ref", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_escrow_adjustments_tour").on(table.tourId, table.status),
    index("idx_escrow_adjustments_request").on(table.crossoverRequestId),
    // One escrow row per crossover request — the real guard behind
    // lockItinerary's idempotency (replaces the racy SELECT-then-INSERT).
    uniqueIndex("uq_escrow_adjustments_request").on(table.crossoverRequestId),
  ]
);

/**
 * Priority Matching Voucher — awarded when a user reports an unsafe
 * crossover partner. Burns one use at feed-render time (NOT at
 * issuance), so a user who reports + then never opens the feed
 * doesn't burn a use accidentally.
 */
export const priorityMatchingVouchers = pgTable(
  "priority_matching_vouchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    issuedForRequestId: uuid("issued_for_request_id").references(
      () => tourCrossoverRequests.id,
      { onDelete: "set null" },
    ),
    usesRemaining: integer("uses_remaining").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_priority_vouchers_user").on(table.userId, table.usesRemaining),
  ]
);

/**
 * Dedupe table for the T-36h Discovery Mode push. `dedupe_key` is the
 * tuple `<tour_id>-<recipient_user_id>-<t_minus_hour>`; the unique
 * index lets the cron re-run safely without re-pushing the same user.
 */
export const crossoverDiscoveryPushes = pgTable(
  "crossover_discovery_pushes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tourId: uuid("tour_id")
      .references(() => tours.id, { onDelete: "cascade" })
      .notNull(),
    recipientUserId: uuid("recipient_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tMinusHour: integer("t_minus_hour").notNull(),
    pushedAt: timestamp("pushed_at", { withTimezone: true }).notNull().defaultNow(),
    dedupeKey: varchar("dedupe_key", { length: 120 }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_discovery_pushes_dedupe").on(table.dedupeKey),
    index("idx_discovery_pushes_tour").on(table.tourId),
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // tourId is nullable now: legacy algorithmic tours still use the 1:1 link,
    // but new multi-line orders use `orderId` instead. Exactly one of the two
    // must be set at insert time (enforced in payment.router.confirm / the
    // new order.createPayment path).
    tourId: uuid("tour_id")
      .unique()
      .references(() => tours.id, { onDelete: "set null" }),
    orderId: uuid("order_id")
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).default("VND"),
    paymentMethod: varchar("payment_method", { length: 30 }).notNull(),
    paymentGateway: varchar("payment_gateway", { length: 30 }).notNull(),
    gatewayTxnId: varchar("gateway_txn_id", { length: 255 }),
    status: varchar("status", { length: 20 }).default("pending"),
    refundAmount: integer("refund_amount").default(0),
    refundReason: varchar("refund_reason", { length: 255 }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    // Optional wrap-up coupon applied at /checkout. Server validates
    // ownership + non-expired + non-redeemed at `payment.createIntent`
    // and atomically flips the coupon to redeemed inside the
    // `payment.confirm` transaction (so a cancelled checkout never
    // burns the code). ON DELETE SET NULL — wiping a coupon row leaves
    // a historic payment intact for audit.
    appliedCouponId: uuid("applied_coupon_id").references(() => coupons.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_payments_tour").on(table.tourId),
    index("idx_payments_status").on(table.status),
  ]
);

// ============================================================================
// PRODUCT PIVOT (Apr 2026): Flexible Tours, Activities, Cart/Orders, Merch
//
// The original algorithmic-tour model (plan -> AI -> hosts -> checkout, 1 tour
// per payment) is being demoted to "legacy" in favour of a standardised-tour +
// a-la-carte-activities model. The schema below supports both:
//
//   - Fixed Tours: existing `experiences` with kind='curated'. No schema change.
//   - Flexible Tours: new `activities` table (a-la-carte tickets). Travelers
//     pick multiple activities from different hosts, each with its own time
//     slots (`activity_slots`). Cart is persistent (`cart_items`), multi-line
//     checkout produces an `orders` row + N `order_items`.
//   - Merch: `products` + `product_variants` (SKU-level inventory).
//   - eSIM + guide add-ons: carried on the cart as add-on line items.
//
// Payments remain 1:1 with `tours` (legacy) OR 1:1 with `orders` (new flow).
// The payments table gains a nullable `orderId` alongside the existing tourId
// so both flows cohabit without breaking existing integration tests.
// ============================================================================

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Author is a host (or LOCOMATE admin). An activity authored by a deleted
    // user is archived, not cascaded, so historical bookings keep their context.
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    titleVi: varchar("title_vi", { length: 200 }),
    titleEn: varchar("title_en", { length: 200 }),
    slug: varchar("slug", { length: 250 }).unique(),
    subtitle: varchar("subtitle", { length: 300 }),
    subtitleVi: varchar("subtitle_vi", { length: 300 }),
    subtitleEn: varchar("subtitle_en", { length: 300 }),
    description: text("description"),
    descriptionVi: text("description_vi"),
    descriptionEn: text("description_en"),
    // 'workshop' | 'ticket' | 'class' | 'tour_lite' | 'performance' | 'food'
    // Mostly for filtering in /activities; price + slot semantics are uniform.
    category: varchar("category", { length: 40 }).notNull(),
    // Bounded pricing like marketplace tours. Fixed per-ticket; the cart sums
    // the chosen quantity to compute line total.
    priceAmount: integer("price_amount").notNull(),
    currency: varchar("currency", { length: 3 }).default("VND").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    maxCapacityPerSlot: integer("max_capacity_per_slot").default(8).notNull(),
    // Optional link to a primary `place` so the activity shows up on maps and
    // in proximity-based recommendations without a separate table.
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
    photos: text("photos").array().default([]),
    highlights: jsonb("highlights").default([]),
    highlightsVi: jsonb("highlights_vi"),
    highlightsEn: jsonb("highlights_en"),
    included: jsonb("included").default([]),
    includedVi: jsonb("included_vi"),
    includedEn: jsonb("included_en"),
    requirements: jsonb("requirements").default([]), // "wear flat shoes", "bring sunscreen"
    requirementsVi: jsonb("requirements_vi"),
    requirementsEn: jsonb("requirements_en"),
    guideOptional: boolean("guide_optional").default(true),
    guideAddonVnd: integer("guide_addon_vnd").default(200_000),
    // Lifecycle: 'draft' | 'published' | 'archived' | 'rejected'.
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    avgRating: decimal("avg_rating", { precision: 3, scale: 2 }).default("0.00"),
    totalBookings: integer("total_bookings").default(0),
    // Provenance for atoms backfilled from `fixed_tour_steps`. Set on atoms,
    // null on normal host-authored activities. Lets `/activities` flag a
    // card with a "From: <Tour Title>" badge and the recipe-guide skip
    // already-minted steps on re-runs. ON DELETE SET NULL — losing the
    // source step doesn't justify deleting an activity that may already
    // sit in cart_items or paid orders. The `AnyPgColumn` return type
    // breaks the recursive TS-inference loop created by the bidirectional
    // FK with `fixed_tour_steps.activity_id`.
    sourceFixedTourStepId: uuid("source_fixed_tour_step_id").references((): AnyPgColumn => fixedTourSteps.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_activities_author").on(table.authorId),
    index("idx_activities_public").on(table.status, table.category),
    index("idx_activities_place").on(table.placeId),
    index("idx_activities_source_step").on(table.sourceFixedTourStepId),
  ]
);

// Time-slotted availability calendar. Each slot row represents a runnable
// session for an activity (e.g. "Cooking class at 10:00 on Apr 14, 8 seats").
//
// Invariant: 0 <= booked_count <= capacity. Enforced at the database layer
// via CHECK constraints (see scripts/create-booking-integrity.ts) AND at
// the application layer via a conditional `UPDATE ... WHERE booked_count +
// qty <= capacity` in `order.confirmPayment`.
//
// Lifecycle:
//   - Inserted at capacity N by the host via activity.addSlot (bookedCount=0).
//   - `order.confirmPayment` increments bookedCount by the order line qty.
//   - `payment.refund` decrements bookedCount back and flips status -> 'open'
//     when the slot had been marked 'sold_out'.
//   - Host can delete an unbooked slot via activity.removeSlot.
//
// Timeline conflict detection operates on (startsAt, endsAt) ranges so the
// UI and order.createFromCart can reject overlapping cart items.
export const activitySlots = pgTable(
  "activity_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    capacity: integer("capacity").notNull(),
    bookedCount: integer("booked_count").default(0).notNull(),
    status: varchar("status", { length: 20 }).default("open").notNull(), // 'open' | 'sold_out' | 'cancelled'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_activity_slots_activity").on(table.activityId, table.startsAt),
    index("idx_activity_slots_window").on(table.startsAt, table.endsAt),
  ]
);

// Persistent cart. One row per line item, scoped to user. kind distinguishes
// what the line refers to: 'fixed_tour' (experiences), 'activity' (activity +
// slot), 'merch' (product variant), 'esim' (SIM package), 'guide_addon'.
// priceSnapshot captures the price at add-time so cart totals are stable
// even if the host updates their listing mid-session.
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 20 }).notNull(),
    // References are nullable individually; at least one must be set per kind.
    // Validation happens in the router (see cart.router.ts).
    experienceId: uuid("experience_id").references(() => experiences.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id").references(() => activities.id, { onDelete: "cascade" }),
    activitySlotId: uuid("activity_slot_id").references(() => activitySlots.id, { onDelete: "cascade" }),
    productVariantId: uuid("product_variant_id").references(
      (): AnyPgColumn => productVariants.id,
      { onDelete: "cascade" },
    ),
    // For esim / guide_addon: the related activity or order scope. Both null
    // when the add-on is cart-wide (e.g. eSIM bundle at checkout).
    parentActivityId: uuid("parent_activity_id").references(() => activities.id, { onDelete: "cascade" }),
    quantity: integer("quantity").default(1).notNull(),
    priceSnapshotVnd: integer("price_snapshot_vnd").notNull(),
    currency: varchar("currency", { length: 3 }).default("VND").notNull(),
    // JSON snapshot of the item's metadata so historical carts can render
    // a readable label even if the upstream row is later deleted.
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_cart_items_user").on(table.userId),
    index("idx_cart_items_slot").on(table.activitySlotId),
  ]
);

// Multi-line order. Created at checkout from cart_items. Status lifecycle:
// 'pending' -> 'paid' -> 'fulfilled' | 'cancelled' | 'refunded'. A single
// payment covers the whole order. Rebuilds from `order_items`.
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Nullable to honor the FK's ON DELETE SET NULL (a deleted user's orders
    // survive with a null buyer rather than cascading away). Matches the real
    // DDL in scripts/create-product-pivot-tables.ts.
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    // Totals are denormalised from order_items at write time -- trading a
    // few bytes for much faster dashboard reads.
    subtotalVnd: integer("subtotal_vnd").notNull(),
    discountVnd: integer("discount_vnd").default(0).notNull(),
    totalVnd: integer("total_vnd").notNull(),
    currency: varchar("currency", { length: 3 }).default("VND").notNull(),
    // Optional bundle discount codes ('ESIM_BUNDLE_10', etc.) applied.
    bundleCodes: jsonb("bundle_codes").default([]),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: varchar("cancel_reason", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_orders_user").on(table.userId, table.createdAt),
    index("idx_orders_status").on(table.status),
  ]
);

// Order line items. Mirrors cart_items at checkout time (prices frozen).
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 20 }).notNull(),
    experienceId: uuid("experience_id").references(() => experiences.id, { onDelete: "set null" }),
    activityId: uuid("activity_id").references(() => activities.id, { onDelete: "set null" }),
    activitySlotId: uuid("activity_slot_id").references(() => activitySlots.id, { onDelete: "set null" }),
    productVariantId: uuid("product_variant_id").references(
      (): AnyPgColumn => productVariants.id,
      { onDelete: "set null" },
    ),
    quantity: integer("quantity").notNull(),
    unitPriceVnd: integer("unit_price_vnd").notNull(),
    lineTotalVnd: integer("line_total_vnd").notNull(),
    currency: varchar("currency", { length: 3 }).default("VND").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_order_items_order").on(table.orderId),
    index("idx_order_items_activity_slot").on(table.activitySlotId),
  ]
);

// Merch catalogue. Flat product + variants for size/color. Admin CMS owns
// writes; travelers read via product.list / product.get.
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: varchar("sku", { length: 40 }).unique().notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    titleVi: varchar("title_vi", { length: 200 }),
    titleEn: varchar("title_en", { length: 200 }),
    slug: varchar("slug", { length: 250 }).unique(),
    subtitle: varchar("subtitle", { length: 300 }),
    subtitleVi: varchar("subtitle_vi", { length: 300 }),
    subtitleEn: varchar("subtitle_en", { length: 300 }),
    description: text("description"),
    descriptionVi: text("description_vi"),
    descriptionEn: text("description_en"),
    // 'apparel' | 'accessory' | 'souvenir' | 'print' | 'bundle'
    category: varchar("category", { length: 40 }).notNull(),
    // Display price (before discounts). Variants may override via priceOverride.
    basePriceVnd: integer("base_price_vnd").notNull(),
    currency: varchar("currency", { length: 3 }).default("VND").notNull(),
    photos: text("photos").array().default([]),
    isActive: boolean("is_active").default(true),
    // 'discount_pct' / 'discount_amount' applied when bundled with a tour
    // or activity. Example: shirt at 250k -> 200k when added alongside a tour.
    bundleDiscountPct: integer("bundle_discount_pct").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_products_category").on(table.category, table.isActive),
    index("idx_products_active").on(table.isActive),
  ]
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 40 }).unique().notNull(),
    // Display label, e.g. "M / Black".
    label: varchar("label", { length: 100 }).notNull(),
    // Stored attributes so the UI can render size/color pickers without
    // parsing the label. { size: 'M', color: 'black' }.
    attributes: jsonb("attributes").default({}),
    priceOverrideVnd: integer("price_override_vnd"),
    stockQuantity: integer("stock_quantity").default(0).notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_product_variants_product").on(table.productId),
  ]
);

// ============================================================================
// End product-pivot block.
// ============================================================================

// Weekly payout ledger. Each row represents a settled payout from LOCOMATE
// to a host covering a specific earnings window. Currently populated manually
// (or by the seed script); a future automated pipeline will append rows here
// after running `computeHostPayout` against succeeded payments for the period.
// See FOLLOW-08 for the automation story.
export const hostPayouts = pgTable(
  "host_payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    hostId: uuid("host_id")
      .references(() => hostProfiles.id, { onDelete: "cascade" })
      .notNull(),
    // Net paid to the host (platform commission already deducted). Stored in
    // minor units of the currency below -- for VND that means whole dong.
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).default("VND").notNull(),
    // 'pending' | 'paid' | 'failed'. Pending rows are forecast / in-flight;
    // paid rows are settled and immutable.
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    // Earnings window this payout covers. Used on the /host/earnings history
    // table to show "Apr 1 - Apr 7" labels and for reconciling which payments
    // are included in which payout.
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    // External reference (bank transaction id, Stripe payout id). Nullable so
    // offline manual payouts can be recorded without forcing a placeholder.
    bankReference: varchar("bank_reference", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_host_payouts_host").on(table.hostId),
    index("idx_host_payouts_period").on(table.hostId, table.periodEnd),
  ]
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    targetType: varchar("target_type", { length: 20 }).notNull(),
    targetId: uuid("target_id").notNull(),
    rating: integer("rating").notNull(),
    comment: varchar("comment", { length: 500 }),
    photos: text("photos").array().default([]),
    isVisible: boolean("is_visible").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_reviews_target").on(table.targetType, table.targetId),
    index("idx_reviews_reviewer").on(table.reviewerId),
  ]
);

/**
 * Phase A.6 — Digital Thank-you Letter.
 *
 * A row is inserted ~1 minute after a tour transitions to `completed`,
 * with `scheduledAt = completedAt + 1 hour`. The hourly cron
 * `/api/cron/send-thank-you` picks rows where `scheduledAt < now() AND
 * sentAt IS NULL`, renders the letter body using `thank-you-letter.ts`,
 * marks `sentAt` and the user sees the letter on `/letters`.
 *
 * The body lives in `body` as jsonb so future iterations (illustrated
 * sign-offs, photo attachments, multi-page versions) don't require
 * another migration. The `tour_id` UNIQUE prevents duplicate letters
 * for the same tour even if the completion hook fires twice.
 */
export const thankYouLetters = pgTable(
  "thank_you_letters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tourId: uuid("tour_id")
      .unique()
      .references(() => tours.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    body: jsonb("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_thank_you_user").on(table.userId, table.sentAt),
    index("idx_thank_you_scheduled").on(table.sentAt, table.scheduledAt),
  ],
);

export const emergencyContacts = pgTable("emergency_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  relationship: varchar("relationship", { length: 50 }),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
  targetType: varchar("target_type", { length: 20 }).notNull(),
  targetId: uuid("target_id").notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  description: varchar("description", { length: 500 }),
  status: varchar("status", { length: 20 }).default("open"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// OAuth provider links. Composite PK (provider, providerAccountId) follows the
// Auth.js / Drizzle adapter convention so adding GitHub/Apple later is additive.
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(),
    provider: varchar("provider", { length: 40 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    expiresAt: integer("expires_at"),
    tokenType: varchar("token_type", { length: 20 }),
    scope: varchar("scope", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("idx_accounts_user").on(table.userId),
  ]
);

/* ────────────────────────────────────────────────────────────────────────
 *  SESSIONS (server-side refresh-token store — Cluster C auth lifecycle)
 *
 *  Refresh tokens move from stateless JWTs to opaque random strings stored
 *  HASHED (sha256) in this table. Every refresh rotates: the presented row
 *  is revoked and a replacement is issued in the same `familyId`. Presenting
 *  an already-revoked token is treated as theft and revokes the whole family.
 *
 *  Access tokens stay short-lived JWTs (now carrying `typ:"access"`) and are
 *  NOT stored here — only the long-lived refresh side is server-tracked.
 *
 *  DDL lives in scripts/create-sessions-table.ts (idempotent) and is mirrored
 *  into src/test/setup.ts for the PGlite suite.
 * ──────────────────────────────────────────────────────────────────── */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // sha256 hex digest of the opaque refresh token. The raw token is only
    // ever held by the client cookie; the DB stores the hash so a DB leak
    // can't be replayed as a session.
    refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull(),
    // Rotation lineage. All rotations of one login share a familyId so reuse
    // of a revoked token can revoke every descendant in one statement.
    familyId: uuid("family_id").notNull(),
    userAgent: varchar("user_agent", { length: 400 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_sessions_user").on(table.userId),
    index("idx_sessions_refresh_hash").on(table.refreshTokenHash),
  ]
);

/* ────────────────────────────────────────────────────────────────────────
 *  WRAP-UP COUPONS (issued on tour.completeTour, redeemed at payment.confirm)
 *
 *  One row per issued coupon. The wrap-up flavour is created in
 *  `services/wrap-up-coupon.ts:issueWrapUpCoupon` after every completed
 *  tour — single-use, 90-day expiry, 10% off the next tour. Codes are
 *  human-readable (`WRAP-XXXXXX`) and namespaced via `kind` so a future
 *  hand-distributed marketing campaign can land here without colliding.
 *
 *  Issuance is idempotent: the partial unique index on
 *  `(source_tour_id) WHERE kind='wrap_up' AND source_tour_id IS NOT NULL`
 *  means a re-run of completeTour returns the existing code, never a
 *  duplicate row.
 *
 *  Redemption is the atomic UPDATE in payment.confirm:
 *    UPDATE coupons SET redeemed_at = NOW(), redeemed_tour_id = ?
 *      WHERE id = ? AND redeemed_at IS NULL RETURNING id
 *  Same "WHERE ... IS NULL" race-loser pattern the booking-concurrency
 *  layer uses for activity_slots — two concurrent confirms can't both
 *  redeem the same code.
 *
 *  CHECK constraints (lives in scripts/create-coupons-table.ts):
 *    - discount_pct > 0 AND discount_pct <= 100
 *    - (redeemed_at, redeemed_tour_id) are both null or both non-null
 * ──────────────────────────────────────────────────────────────────── */
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    kind: varchar("kind", { length: 24 }).notNull().default("wrap_up"),
    //   "wrap_up" | "manual" | (future kinds)
    recipientUserId: uuid("recipient_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    sourceTourId: uuid("source_tour_id").references(() => tours.id, {
      onDelete: "set null",
    }),
    discountPct: integer("discount_pct").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    redeemedTourId: uuid("redeemed_tour_id").references(() => tours.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // The `.unique()` on the code column already creates an index, but
    // we keep this named one for parity with the migration script and
    // for readable EXPLAIN plans.
    uniqueIndex("idx_coupons_code").on(table.code),
    index("idx_coupons_recipient").on(table.recipientUserId, table.redeemedAt),
    // Issuance idempotency: one wrap_up coupon per source tour. Drizzle
    // supports partial uniques via `.where()`; the WHERE clause matches
    // the same predicate in the migration's CREATE UNIQUE INDEX.
    uniqueIndex("idx_coupons_source_tour_unique")
      .on(table.sourceTourId)
      .where(sql`kind = 'wrap_up' AND source_tour_id IS NOT NULL`),
  ]
);
