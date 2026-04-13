ALTER TABLE "users" ADD COLUMN "default_model_id" text;--> statement-breakpoint
UPDATE "users" SET "default_model_id" = 'gpt-5.2-codex' WHERE "default_model_id" IS NULL;--> statement-breakpoint
