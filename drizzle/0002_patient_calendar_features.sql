DO $$
BEGIN
	CREATE TYPE "public"."patient_sex" AS ENUM('male', 'female', 'unknown');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "calendar" (
	"date_str" text PRIMARY KEY NOT NULL,
	"day_after_holiday" boolean,
	"is_holiday" boolean,
	"holiday_streak_len" integer,
	"days_since_streak_end" integer,
	"post_streak_surge" double precision,
	"month_sin" double precision,
	"month_cos" double precision
);
--> statement-breakpoint

ALTER TABLE "calendar" ADD COLUMN IF NOT EXISTS "day_after_holiday" boolean;
--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN IF NOT EXISTS "is_holiday" boolean;
--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN IF NOT EXISTS "holiday_streak_len" integer;
--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN IF NOT EXISTS "days_since_streak_end" integer;
--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN IF NOT EXISTS "post_streak_surge" double precision;
--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN IF NOT EXISTS "month_sin" double precision;
--> statement-breakpoint
ALTER TABLE "calendar" ADD COLUMN IF NOT EXISTS "month_cos" double precision;
--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'visit_date'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'visit_date_str'
	) THEN
		EXECUTE 'ALTER TABLE "patients" RENAME COLUMN "visit_date" TO "visit_date_str"';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'primary_diagnosis'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'diagnosis_code'
	) THEN
		EXECUTE 'ALTER TABLE "patients" RENAME COLUMN "primary_diagnosis" TO "diagnosis_code"';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'department'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'department_str'
	) THEN
		EXECUTE 'ALTER TABLE "patients" RENAME COLUMN "department" TO "department_str"';
	END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "is_primary_diagnosis" boolean;
--> statement-breakpoint
UPDATE "patients" SET "is_primary_diagnosis" = true WHERE "is_primary_diagnosis" IS NULL;
--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "is_primary_diagnosis" SET NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'visit_date_str'
		AND data_type <> 'text'
	) THEN
		EXECUTE $sql$
			ALTER TABLE "patients"
			ALTER COLUMN "visit_date_str" TYPE text
			USING to_char("visit_date_str"::timestamp, 'YYYY-MM-DD')
		$sql$;
	END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'sex'
		AND udt_name <> 'patient_sex'
	) THEN
		EXECUTE $sql$
			ALTER TABLE "patients"
			ALTER COLUMN "sex" TYPE "public"."patient_sex"
			USING CASE
				WHEN "sex"::text IN ('1', 'male', 'Male', 'MALE') THEN 'male'::"public"."patient_sex"
				WHEN "sex"::text IN ('2', 'female', 'Female', 'FEMALE') THEN 'female'::"public"."patient_sex"
				ELSE 'unknown'::"public"."patient_sex"
			END
		$sql$;
	END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "patients" ALTER COLUMN "visit_date_str" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "sex" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "diagnosis_code" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "department_str" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "patients" DROP COLUMN IF EXISTS "secondary_diagnosis";
--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN IF EXISTS "prescription";
--> statement-breakpoint

DROP VIEW IF EXISTS "patient_calendar_features";
--> statement-breakpoint
CREATE VIEW "patient_calendar_features" AS
SELECT
	p."hospital_id",
	p."visit_date_str" AS "date_str",
	COUNT(*) FILTER (WHERE p."sex" = 'female')::integer AS "Female",
	COUNT(*) FILTER (WHERE p."sex" = 'male')::integer AS "Male",
	COUNT(*) FILTER (WHERE p."age" >= 0 AND p."age" < 10)::integer AS "age_0_10",
	COUNT(*) FILTER (WHERE p."age" >= 10 AND p."age" < 20)::integer AS "age_10_20",
	COUNT(*) FILTER (WHERE p."age" >= 20 AND p."age" < 30)::integer AS "age_20_30",
	COUNT(*) FILTER (WHERE p."age" >= 30 AND p."age" < 40)::integer AS "age_30_40",
	COUNT(*) FILTER (WHERE p."age" >= 40 AND p."age" < 50)::integer AS "age_40_50",
	COUNT(*) FILTER (WHERE p."age" >= 50 AND p."age" < 60)::integer AS "age_50_60",
	COUNT(*) FILTER (WHERE p."age" >= 60 AND p."age" < 70)::integer AS "age_60_70",
	COUNT(*) FILTER (WHERE p."age" >= 70 AND p."age" < 80)::integer AS "age_70_80",
	COUNT(*) FILTER (WHERE p."age" >= 80)::integer AS "age_80_plus",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'A')::integer AS "A",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'B')::integer AS "B",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'C')::integer AS "C",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'D')::integer AS "D",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'E')::integer AS "E",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'F')::integer AS "F",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'G')::integer AS "G",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'H')::integer AS "H",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'I')::integer AS "I",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'J')::integer AS "J",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'K')::integer AS "K",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'L')::integer AS "L",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'M')::integer AS "M",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'N')::integer AS "N",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'O')::integer AS "O",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'P')::integer AS "P",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'Q')::integer AS "Q",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'R')::integer AS "R",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'S')::integer AS "S",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'T')::integer AS "T",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'U')::integer AS "U",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'V')::integer AS "V",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'W')::integer AS "W",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'X')::integer AS "X",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'Y')::integer AS "Y",
	COUNT(*) FILTER (WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'Z')::integer AS "Z",
	COUNT(*) FILTER (
		WHERE upper(left(coalesce(p."diagnosis_code", ''), 1)) !~ '^[A-Z]$'
	)::integer AS "Other",
	c."day_after_holiday",
	c."is_holiday",
	c."holiday_streak_len",
	c."days_since_streak_end",
	c."post_streak_surge",
	c."month_sin",
	c."month_cos"
FROM "patients" p
LEFT JOIN "calendar" c
	ON c."date_str" = p."visit_date_str"
GROUP BY
	p."hospital_id",
	p."visit_date_str",
	c."day_after_holiday",
	c."is_holiday",
	c."holiday_streak_len",
	c."days_since_streak_end",
	c."post_streak_surge",
	c."month_sin",
	c."month_cos";
