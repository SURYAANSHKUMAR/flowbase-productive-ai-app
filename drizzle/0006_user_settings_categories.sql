CREATE TYPE "public"."category_scope" AS ENUM('calendar', 'task', 'note', 'reminder');--> statement-breakpoint

CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile" jsonb NOT NULL,
	"subscription" jsonb NOT NULL,
	"preferences" jsonb NOT NULL,
	"notifications" jsonb NOT NULL,
	"ai" jsonb NOT NULL,
	"privacy" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);--> statement-breakpoint

CREATE TABLE "user_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"scope" "category_scope" NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "calendar_items" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "kanban_tasks" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "category_id" integer;--> statement-breakpoint

ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_categories" ADD CONSTRAINT "user_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_category_id_user_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."user_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_tasks" ADD CONSTRAINT "kanban_tasks_category_id_user_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."user_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_category_id_user_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."user_categories"("id") ON DELETE no action ON UPDATE no action;
