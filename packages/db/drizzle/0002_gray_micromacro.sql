ALTER TABLE "plots" DROP CONSTRAINT "plots_tier_range";--> statement-breakpoint
ALTER TABLE "structures" ALTER COLUMN "farm_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "structures" ADD COLUMN "plot_id" uuid;--> statement-breakpoint
ALTER TABLE "structures" ADD COLUMN "w" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "structures" ADD COLUMN "h" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "structures" ADD CONSTRAINT "structures_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "structures_by_plot" ON "structures" USING btree ("plot_id");--> statement-breakpoint
ALTER TABLE "plots" DROP COLUMN "tier";--> statement-breakpoint
ALTER TABLE "structures" ADD CONSTRAINT "structures_owner_xor" CHECK (("structures"."farm_id" is null) <> ("structures"."plot_id" is null));