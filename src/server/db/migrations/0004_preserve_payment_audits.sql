ALTER TABLE "payments" ALTER COLUMN "tour_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_tour_id_tours_id_fk";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE set null ON UPDATE no action;
