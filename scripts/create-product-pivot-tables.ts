import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent DDL for the Apr-2026 product pivot:
 *   - activities        (a-la-carte tickets / workshops / experiences)
 *   - activity_slots    (time-slotted availability calendar)
 *   - cart_items        (persistent multi-line cart)
 *   - orders            (multi-line order header)
 *   - order_items       (frozen line items at checkout)
 *   - products          (merch catalogue)
 *   - product_variants  (size/color/inventory per product)
 *   - ALTER payments ADD COLUMN order_id (nullable; legacy tours keep tour_id)
 *
 * Safe to re-run. Execute once per environment:
 *   npx tsx scripts/create-product-pivot-tables.ts
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(databaseUrl, { max: 1 });

  console.log("Creating product-pivot tables (idempotent)...");

  await sql`
    CREATE TABLE IF NOT EXISTS activities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id uuid REFERENCES users(id) ON DELETE SET NULL,
      title varchar(200) NOT NULL,
      slug varchar(250) UNIQUE,
      subtitle varchar(300),
      description text,
      category varchar(40) NOT NULL,
      price_amount integer NOT NULL,
      currency varchar(3) NOT NULL DEFAULT 'VND',
      duration_minutes integer NOT NULL,
      max_capacity_per_slot integer NOT NULL DEFAULT 8,
      place_id uuid REFERENCES places(id) ON DELETE SET NULL,
      photos text[] DEFAULT '{}',
      highlights jsonb DEFAULT '[]',
      included jsonb DEFAULT '[]',
      requirements jsonb DEFAULT '[]',
      guide_optional boolean DEFAULT true,
      guide_addon_vnd integer DEFAULT 200000,
      status varchar(20) NOT NULL DEFAULT 'draft',
      published_at timestamptz,
      review_notes text,
      avg_rating numeric(3,2) DEFAULT 0.00,
      total_bookings integer DEFAULT 0,
      created_at timestamptz DEFAULT NOW(),
      updated_at timestamptz DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_activities_author ON activities(author_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_activities_public ON activities(status, category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_activities_place ON activities(place_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS activity_slots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      capacity integer NOT NULL,
      booked_count integer NOT NULL DEFAULT 0,
      status varchar(20) NOT NULL DEFAULT 'open',
      created_at timestamptz DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_slots_activity ON activity_slots(activity_id, starts_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_slots_window ON activity_slots(starts_at, ends_at)`;

  // Orders + order_items. Created BEFORE cart_items because the FK from
  // payments.order_id references orders.id (alter step below).
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      status varchar(20) NOT NULL DEFAULT 'pending',
      subtotal_vnd integer NOT NULL,
      discount_vnd integer NOT NULL DEFAULT 0,
      total_vnd integer NOT NULL,
      currency varchar(3) NOT NULL DEFAULT 'VND',
      bundle_codes jsonb DEFAULT '[]',
      paid_at timestamptz,
      cancelled_at timestamptz,
      cancel_reason varchar(255),
      created_at timestamptz DEFAULT NOW(),
      updated_at timestamptz DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sku varchar(40) UNIQUE NOT NULL,
      title varchar(200) NOT NULL,
      slug varchar(250) UNIQUE,
      subtitle varchar(300),
      description text,
      category varchar(40) NOT NULL,
      base_price_vnd integer NOT NULL,
      currency varchar(3) NOT NULL DEFAULT 'VND',
      photos text[] DEFAULT '{}',
      is_active boolean DEFAULT true,
      bundle_discount_pct integer DEFAULT 0,
      created_at timestamptz DEFAULT NOW(),
      updated_at timestamptz DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category, is_active)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)`;

  await sql`
    CREATE TABLE IF NOT EXISTS product_variants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sku varchar(40) UNIQUE NOT NULL,
      label varchar(100) NOT NULL,
      attributes jsonb DEFAULT '{}',
      price_override_vnd integer,
      stock_quantity integer NOT NULL DEFAULT 0,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id)`;

  // cart_items -- references activities / activity_slots / experiences /
  // product_variants. product_variants FK added inline.
  await sql`
    CREATE TABLE IF NOT EXISTS cart_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind varchar(20) NOT NULL,
      experience_id uuid REFERENCES experiences(id) ON DELETE CASCADE,
      activity_id uuid REFERENCES activities(id) ON DELETE CASCADE,
      activity_slot_id uuid REFERENCES activity_slots(id) ON DELETE CASCADE,
      product_variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
      parent_activity_id uuid REFERENCES activities(id) ON DELETE CASCADE,
      quantity integer NOT NULL DEFAULT 1,
      price_snapshot_vnd integer NOT NULL,
      currency varchar(3) NOT NULL DEFAULT 'VND',
      metadata jsonb DEFAULT '{}',
      created_at timestamptz DEFAULT NOW(),
      updated_at timestamptz DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cart_items_slot ON cart_items(activity_slot_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      kind varchar(20) NOT NULL,
      experience_id uuid REFERENCES experiences(id) ON DELETE SET NULL,
      activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
      activity_slot_id uuid REFERENCES activity_slots(id) ON DELETE SET NULL,
      product_variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
      quantity integer NOT NULL,
      unit_price_vnd integer NOT NULL,
      line_total_vnd integer NOT NULL,
      currency varchar(3) NOT NULL DEFAULT 'VND',
      metadata jsonb DEFAULT '{}',
      created_at timestamptz DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_items_activity_slot ON order_items(activity_slot_id)`;

  // Relax payments.tour_id to nullable + add order_id.
  await sql`ALTER TABLE payments ALTER COLUMN tour_id DROP NOT NULL`;
  await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_id uuid UNIQUE REFERENCES orders(id) ON DELETE CASCADE`;
  // Preserve financial audit rows when a user or their legacy tour is deleted.
  // The original base migration used tour_id ON DELETE CASCADE and user_id
  // NO ACTION; both are now SET NULL so the immutable payment row survives.
  await sql`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_tour_id_tours_id_fk`;
  await sql`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_tour_id_fkey`;
  await sql`
    ALTER TABLE payments
      ADD CONSTRAINT payments_tour_id_tours_id_fk
      FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL
  `;
  await sql`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_users_id_fk`;
  await sql`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey`;
  await sql`
    ALTER TABLE payments
      ADD CONSTRAINT payments_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  `;

  console.log("Product-pivot tables ready.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
