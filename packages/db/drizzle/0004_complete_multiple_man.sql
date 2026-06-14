CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plot_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"price" bigint NOT NULL,
	"currency" text DEFAULT 'shards' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sold_to" uuid,
	"sold_at" timestamp with time zone,
	CONSTRAINT "listings_price_pos" CHECK ("listings"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "treasury" (
	"currency" text PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DROP INDEX "plots_one_per_owner";--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_characters_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_sold_to_characters_id_fk" FOREIGN KEY ("sold_to") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listings_one_active_per_plot" ON "listings" USING btree ("plot_id") WHERE "listings"."status" = 'active';--> statement-breakpoint
CREATE INDEX "listings_by_status" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "plots_by_owner" ON "plots" USING btree ("owner_id");