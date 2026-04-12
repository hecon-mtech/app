CREATE TYPE "public"."config_value_type" AS ENUM('string', 'number', 'boolean');--> statement-breakpoint
CREATE TYPE "public"."flow_type" AS ENUM('prediction', 'actual', 'prediction_upper', 'prediction_lower');--> statement-breakpoint
CREATE TYPE "public"."patient_type" AS ENUM('inpatient', 'outpatient');--> statement-breakpoint
CREATE TYPE "public"."message_entity" AS ENUM('system', 'user', 'assistant');--> statement-breakpoint
CREATE TABLE "drugs_price" (
	"drug_code" text NOT NULL,
	"price" numeric NOT NULL,
	"source" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drugs" (
	"fda_class" text NOT NULL,
	"ingredient_code" text NOT NULL,
	"drug_code" text PRIMARY KEY NOT NULL,
	"drug_name" text NOT NULL,
	"manufactor" text NOT NULL,
	"atc_code" text NOT NULL,
	"atc_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_ai_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"oauth" jsonb,
	"api_key" text,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"password" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"config_id" text NOT NULL,
	"config_desc" text NOT NULL,
	"config_value" text NOT NULL,
	"config_value_type" "config_value_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"date_str" text NOT NULL,
	"drug_id" text NOT NULL,
	"quantity" numeric NOT NULL,
	"type_" "flow_type" NOT NULL,
	"stock" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_bids" (
	"id" serial PRIMARY KEY NOT NULL,
	"reg_inventory_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"price" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_reg_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"drug_id" text NOT NULL,
	"quantity" numeric NOT NULL,
	"expire_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"patient_id" integer NOT NULL,
	"visit_date" timestamp NOT NULL,
	"type" "patient_type" NOT NULL,
	"sex" integer NOT NULL,
	"age" integer NOT NULL,
	"primary_diagnosis" text NOT NULL,
	"secondary_diagnosis" text NOT NULL,
	"prescription" text NOT NULL,
	"department" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"credential_id" integer NOT NULL,
	"model_id" text NOT NULL,
	"prompt_cache_key" text NOT NULL,
	"session_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"entity" "message_entity" NOT NULL,
	"content" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drugs_price" ADD CONSTRAINT "drugs_price_drug_code_drugs_drug_code_fk" FOREIGN KEY ("drug_code") REFERENCES "public"."drugs"("drug_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_ai_credentials" ADD CONSTRAINT "open_ai_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configurations" ADD CONSTRAINT "configurations_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_drug_id_drugs_drug_code_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."drugs"("drug_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_reg_inventory_id_auction_reg_inventory_id_fk" FOREIGN KEY ("reg_inventory_id") REFERENCES "public"."auction_reg_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_reg_inventory" ADD CONSTRAINT "auction_reg_inventory_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_reg_inventory" ADD CONSTRAINT "auction_reg_inventory_drug_id_drugs_drug_code_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."drugs"("drug_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_session" ADD CONSTRAINT "message_session_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_session" ADD CONSTRAINT "message_session_credential_id_open_ai_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."open_ai_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_message_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."message_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "open_ai_credentials_user_idx" ON "open_ai_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "open_ai_credentials_user_name_uidx" ON "open_ai_credentials" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "configurations_hospital_config_uidx" ON "configurations" USING btree ("hospital_id","config_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_hospital_date_drug_type_uidx" ON "inventory" USING btree ("hospital_id","date_str","drug_id","type_");--> statement-breakpoint
CREATE INDEX "message_session_hospital_updated_idx" ON "message_session" USING btree ("hospital_id","updated_at");--> statement-breakpoint
CREATE INDEX "message_session_credential_idx" ON "message_session" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "messages_session_created_idx" ON "messages" USING btree ("session_id","created_at");