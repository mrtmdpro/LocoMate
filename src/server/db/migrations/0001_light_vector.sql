ALTER TABLE "places" ADD COLUMN "slug" varchar(250);--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_slug_unique" UNIQUE("slug");