CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_owner_id_app_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;