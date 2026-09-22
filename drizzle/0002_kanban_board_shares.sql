CREATE TABLE "kanban_board_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kanban_board_shares" ADD CONSTRAINT "kanban_board_shares_board_id_kanban_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_board_shares" ADD CONSTRAINT "kanban_board_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kanban_board_shares_board_user_idx" ON "kanban_board_shares" USING btree ("board_id","user_id");
