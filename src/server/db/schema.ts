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
    bio: varchar("bio", { length: 300 }),
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
    slug: varchar("slug", { length: 250 }).unique(),
    description: varchar("description", { length: 500 }),
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

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userAId: uuid("user_a_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    userBId: uuid("user_b_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
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
  },
  (table) => [index("idx_messages_match").on(table.matchId, table.createdAt)]
);

export const tours = pgTable(
  "tours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    hostId: uuid("host_id").references(() => hostProfiles.id),
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

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tourId: uuid("tour_id")
      .unique()
      .references(() => tours.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).default("VND"),
    paymentMethod: varchar("payment_method", { length: 30 }).notNull(),
    paymentGateway: varchar("payment_gateway", { length: 30 }).notNull(),
    gatewayTxnId: varchar("gateway_txn_id", { length: 255 }),
    status: varchar("status", { length: 20 }).default("pending"),
    refundAmount: integer("refund_amount").default(0),
    refundReason: varchar("refund_reason", { length: 255 }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_payments_tour").on(table.tourId),
    index("idx_payments_status").on(table.status),
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
