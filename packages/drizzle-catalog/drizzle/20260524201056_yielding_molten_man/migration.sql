CREATE TABLE "orgs" (
	"id" text PRIMARY KEY,
	"clerk_org_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"neon_project_id" text NOT NULL,
	"neon_connection_string" text NOT NULL,
	"service_connection_string" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "orgs_clerk_org_id_idx" ON "orgs" ("clerk_org_id");