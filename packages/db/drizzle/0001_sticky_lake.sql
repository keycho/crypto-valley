CREATE TABLE "plots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plot_index" integer NOT NULL,
	"owner_id" uuid,
	"tier" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"w" integer NOT NULL,
	"h" integer NOT NULL,
	CONSTRAINT "plots_plot_index_unique" UNIQUE("plot_index"),
	CONSTRAINT "plots_tier_range" CHECK ("plots"."tier" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "world_nodes" (
	"node_id" text PRIMARY KEY NOT NULL,
	"harvested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plots" ADD CONSTRAINT "plots_owner_id_characters_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plots_one_per_owner" ON "plots" USING btree ("owner_id") WHERE "plots"."owner_id" is not null;