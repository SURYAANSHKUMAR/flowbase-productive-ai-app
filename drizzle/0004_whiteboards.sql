CREATE TABLE "whiteboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'teal' NOT NULL,
	"elements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"app_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"files" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
