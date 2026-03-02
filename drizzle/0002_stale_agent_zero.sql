CREATE TABLE "atc_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipt_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"grn_id" text NOT NULL,
	"drug_id" text NOT NULL,
	"quantity" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"po_id" text,
	"hospital_id" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" text NOT NULL,
	"drug_id" text NOT NULL,
	"ordered_qty" numeric NOT NULL,
	"received_qty" numeric NOT NULL,
	"unit_price" numeric
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"supplier_name" text NOT NULL,
	"status" text NOT NULL,
	"ordered_at" timestamp with time zone,
	"expected_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "stock_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"drug_id" text NOT NULL,
	"on_hand" numeric NOT NULL,
	"reserved" numeric NOT NULL,
	"reorder_point" numeric NOT NULL,
	"reorder_qty" numeric NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"hospital_id" text NOT NULL,
	"drug_id" text NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" numeric NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"note" text,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "current_usages" DROP CONSTRAINT "current_usages_drug_id_drugs_drug_code_fk";
--> statement-breakpoint
ALTER TABLE "supply_predictions" DROP CONSTRAINT "supply_predictions_drug_id_drugs_drug_code_fk";
--> statement-breakpoint
ALTER TABLE "drugs" ADD COLUMN "atc_5" text NOT NULL;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_grn_id_goods_receipts_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."goods_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_drug_id_atc_codes_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."atc_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_drug_id_atc_codes_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."atc_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_drug_id_atc_codes_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."atc_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_drug_id_atc_codes_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."atc_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_usages" ADD CONSTRAINT "current_usages_drug_id_atc_codes_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."atc_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_predictions" ADD CONSTRAINT "supply_predictions_drug_id_atc_codes_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."atc_codes"("id") ON DELETE no action ON UPDATE no action;