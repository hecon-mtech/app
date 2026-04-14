CREATE TABLE IF NOT EXISTS "session_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"summary" text NOT NULL,
	"summarized_up_to" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_summaries_session_id_unique" UNIQUE("session_id")
);

DO $$ BEGIN
	ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_session_id_message_session_id_fk"
		FOREIGN KEY ("session_id") REFERENCES "public"."message_session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
