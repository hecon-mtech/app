DROP VIEW IF EXISTS "stock_usage_view";
--> statement-breakpoint
DROP TABLE IF EXISTS "auction_bids" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "auction_reg_inventory" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "configurations" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "inventory" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "usages" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "usage_prediction_bounds" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "goods_receipt_items" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "goods_receipts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "purchase_order_items" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "purchase_orders" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "stock_balances" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "stock_movements" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "supply_predictions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "current_usages" CASCADE;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."usage_type";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."config_value_type";
--> statement-breakpoint
CREATE TABLE "atc_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drugs" (
	"fda_class" text NOT NULL,
	"ingredient_code" text NOT NULL,
	"drug_code" text PRIMARY KEY NOT NULL,
	"drug_name" text NOT NULL,
	"manufactor" text NOT NULL,
	"atc_code" text NOT NULL,
	"atc_name" text NOT NULL,
	"atc_5" text NOT NULL
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
CREATE TYPE "public"."usage_type" AS ENUM('prediction', 'actual');
--> statement-breakpoint
CREATE TYPE "public"."config_value_type" AS ENUM('string', 'number', 'boolean');
--> statement-breakpoint
CREATE TABLE "usages" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"drug_id" text NOT NULL,
	"quantity" numeric NOT NULL,
	"type_" "usage_type" NOT NULL,
	"date_str" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_prediction_bounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"drug_id" text NOT NULL,
	"date_str" text NOT NULL,
	"upper" numeric NOT NULL,
	"lower" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"drug_id" text NOT NULL,
	"date_str" text NOT NULL,
	"quantity" numeric NOT NULL,
	"is_real" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "inpatient_patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"patient_id" integer NOT NULL,
	"visit_date" timestamp NOT NULL,
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
CREATE TABLE "outpatient_patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"patient_id" integer NOT NULL,
	"visit_date" timestamp NOT NULL,
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
CREATE TABLE "auction_bids" (
	"id" serial PRIMARY KEY NOT NULL,
	"reg_inventory_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"price" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drugs" ADD CONSTRAINT "drugs_atc_5_atc_codes_id_fk" FOREIGN KEY ("atc_5") REFERENCES "public"."atc_codes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "usages" ADD CONSTRAINT "usages_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "usages" ADD CONSTRAINT "usages_drug_id_atc_codes_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."atc_codes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "usage_prediction_bounds" ADD CONSTRAINT "usage_prediction_bounds_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "usage_prediction_bounds" ADD CONSTRAINT "usage_prediction_bounds_drug_id_atc_codes_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."atc_codes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_drug_id_atc_codes_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."atc_codes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "configurations" ADD CONSTRAINT "configurations_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inpatient_patients" ADD CONSTRAINT "inpatient_patients_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "outpatient_patients" ADD CONSTRAINT "outpatient_patients_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auction_reg_inventory" ADD CONSTRAINT "auction_reg_inventory_hospital_id_users_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auction_reg_inventory" ADD CONSTRAINT "auction_reg_inventory_drug_id_atc_codes_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."atc_codes"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_reg_inventory_id_auction_reg_inventory_id_fk" FOREIGN KEY ("reg_inventory_id") REFERENCES "public"."auction_reg_inventory"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "inventory_hospital_drug_date_idx" ON "inventory" USING btree ("hospital_id","drug_id","date_str");
--> statement-breakpoint
CREATE INDEX "usage_pred_bounds_hospital_drug_date_idx" ON "usage_prediction_bounds" USING btree ("hospital_id","drug_id","date_str");
--> statement-breakpoint
CREATE OR REPLACE VIEW "stock_usage_view" AS
WITH usage_daily AS (
	SELECT
		hospital_id,
		drug_id,
		date_str,
		sum(CASE WHEN type_ = 'actual' THEN quantity::numeric ELSE 0 END) AS actual_usage_qty,
		sum(CASE WHEN type_ = 'prediction' THEN quantity::numeric ELSE 0 END) AS predicted_usage_qty
	FROM usages
	GROUP BY hospital_id, drug_id, date_str
),
inventory_daily AS (
	SELECT
		hospital_id,
		drug_id,
		date_str,
		sum(quantity::numeric) AS inventory_qty,
		bool_or(is_real) AS has_real_count
	FROM inventory
	GROUP BY hospital_id, drug_id, date_str
)
SELECT
	i.hospital_id AS hospital_id,
	i.drug_id AS drug_id,
	i.date_str AS date_str,
	coalesce(i.inventory_qty, 0) AS inventory_qty,
	coalesce(u.actual_usage_qty, 0) AS actual_usage_qty,
	coalesce(u.predicted_usage_qty, 0) AS predicted_usage_qty,
	coalesce(i.inventory_qty, 0) - coalesce(u.actual_usage_qty, 0) AS stock_after_actual,
	coalesce(i.inventory_qty, 0) - coalesce(u.predicted_usage_qty, 0) AS stock_after_prediction,
	coalesce(i.has_real_count, false) AS has_real_count
FROM inventory_daily i
LEFT JOIN usage_daily u
	ON i.hospital_id = u.hospital_id
	AND i.drug_id = u.drug_id
	AND i.date_str = u.date_str;
