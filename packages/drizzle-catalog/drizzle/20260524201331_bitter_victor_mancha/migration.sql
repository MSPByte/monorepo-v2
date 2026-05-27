ALTER TABLE "orgs" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "orgs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();