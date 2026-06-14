CREATE TABLE "quest_progress" (
	"character_id" uuid NOT NULL,
	"quest_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"objectives" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"day" integer,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_progress_character_id_quest_id_pk" PRIMARY KEY("character_id","quest_id")
);
--> statement-breakpoint
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;