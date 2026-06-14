CREATE TABLE "season_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"season_number" integer NOT NULL,
	"character_id" uuid NOT NULL,
	"board" text NOT NULL,
	"rank" integer NOT NULL,
	"prize_shards" bigint DEFAULT 0 NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_scores" (
	"season_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"profit" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_scores_season_id_character_id_pk" PRIMARY KEY("season_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"pool_shards" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "seasons_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_scores" ADD CONSTRAINT "season_scores_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_scores" ADD CONSTRAINT "season_scores_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "season_results_by_character" ON "season_results" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_one_active" ON "seasons" USING btree ("status") WHERE "seasons"."status" = 'active';