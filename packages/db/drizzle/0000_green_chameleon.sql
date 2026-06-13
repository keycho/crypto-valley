CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"appearance" jsonb NOT NULL,
	"shards" bigint DEFAULT 500 NOT NULL,
	"energy" integer DEFAULT 100 NOT NULL,
	"energy_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"pos_zone" text DEFAULT 'farm' NOT NULL,
	"pos_x" integer DEFAULT 25 NOT NULL,
	"pos_y" integer DEFAULT 25 NOT NULL,
	"skills" jsonb DEFAULT '{"farming":0,"mining":0,"foraging":0,"crafting":0,"archaeology":0}'::jsonb NOT NULL,
	"tutorial_step" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "characters_account_id_unique" UNIQUE("account_id"),
	CONSTRAINT "characters_name_unique" UNIQUE("name"),
	CONSTRAINT "characters_shards_nonneg" CHECK ("characters"."shards" >= 0),
	CONSTRAINT "characters_name_len" CHECK (length("characters"."name") between 3 and 16)
);
--> statement-breakpoint
CREATE TABLE "crops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"crop_id" text NOT NULL,
	"planted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"watered_until" timestamp with time zone,
	"growth_credit_ms" bigint DEFAULT 0 NOT NULL,
	"fertilizer" text,
	"season_planted" integer NOT NULL,
	CONSTRAINT "crops_farm_xy" UNIQUE("farm_id","x","y")
);
--> statement-breakpoint
CREATE TABLE "farm_tiles" (
	"farm_id" uuid NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"state" text NOT NULL,
	"watered_until" timestamp with time zone,
	CONSTRAINT "farm_tiles_farm_id_x_y_pk" PRIMARY KEY("farm_id","x","y")
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text DEFAULT 'Abandoned Plot' NOT NULL,
	"layout_rev" integer DEFAULT 0 NOT NULL,
	"deed_asset_id" text,
	CONSTRAINT "farms_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_slots" (
	"character_id" uuid NOT NULL,
	"container" text DEFAULT 'backpack' NOT NULL,
	"slot" integer NOT NULL,
	"item_id" text NOT NULL,
	"qty" integer NOT NULL,
	"instance_meta" jsonb,
	CONSTRAINT "inventory_slots_character_id_container_slot_pk" PRIMARY KEY("character_id","container","slot"),
	CONSTRAINT "inventory_qty_pos" CHECK ("inventory_slots"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "item_defs" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"stack_max" integer DEFAULT 999 NOT NULL,
	"base_value" bigint DEFAULT 0 NOT NULL,
	"tradeable" boolean DEFAULT true NOT NULL,
	"mintable" boolean DEFAULT false NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"character_id" uuid NOT NULL,
	"delta_shards" bigint NOT NULL,
	"reason" text NOT NULL,
	"ref" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"structure_id" uuid NOT NULL,
	"recipe_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finishes_at" timestamp with time zone NOT NULL,
	"collected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"def_id" text NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crops" ADD CONSTRAINT "crops_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crops" ADD CONSTRAINT "crops_crop_id_item_defs_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."item_defs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_tiles" ADD CONSTRAINT "farm_tiles_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_owner_id_characters_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_slots" ADD CONSTRAINT "inventory_slots_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_slots" ADD CONSTRAINT "inventory_slots_item_id_item_defs_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item_defs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_jobs" ADD CONSTRAINT "machine_jobs_structure_id_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structures" ADD CONSTRAINT "structures_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inv_by_item" ON "inventory_slots" USING btree ("character_id","item_id");--> statement-breakpoint
CREATE INDEX "ledger_by_character" ON "ledger" USING btree ("character_id","at");--> statement-breakpoint
CREATE INDEX "jobs_ready" ON "machine_jobs" USING btree ("structure_id") WHERE not "machine_jobs"."collected";