CREATE INDEX IF NOT EXISTS "inventory_hospital_date_drug_idx"
ON "inventory" USING btree ("hospital_id", "date_str", "drug_id");
