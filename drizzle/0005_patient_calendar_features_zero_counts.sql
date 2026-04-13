DROP VIEW IF EXISTS "patient_calendar_features";
--> statement-breakpoint

CREATE VIEW "patient_calendar_features" AS
SELECT
	u."id" AS "hospital_id",
	c."date_str",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND p."sex" = 'female')::integer AS "Female",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND p."sex" = 'male')::integer AS "Male",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND p."age" >= 0 AND p."age" < 10)::integer AS "age_0_10",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND p."age" >= 10 AND p."age" < 20)::integer AS "age_10_20",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND p."age" >= 20 AND p."age" < 30)::integer AS "age_20_30",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND p."age" >= 30 AND p."age" < 40)::integer AS "age_30_40",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND p."age" >= 40 AND p."age" < 50)::integer AS "age_40_50",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND p."age" >= 50 AND p."age" < 60)::integer AS "age_50_60",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND p."age" >= 60 AND p."age" < 70)::integer AS "age_60_70",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND p."age" >= 70 AND p."age" < 80)::integer AS "age_70_80",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND p."age" >= 80)::integer AS "age_80_plus",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'A')::integer AS "A",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'B')::integer AS "B",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'C')::integer AS "C",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'D')::integer AS "D",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'E')::integer AS "E",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'F')::integer AS "F",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'G')::integer AS "G",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'H')::integer AS "H",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'I')::integer AS "I",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'J')::integer AS "J",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'K')::integer AS "K",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'L')::integer AS "L",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'M')::integer AS "M",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'N')::integer AS "N",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'O')::integer AS "O",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'P')::integer AS "P",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'Q')::integer AS "Q",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'R')::integer AS "R",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'S')::integer AS "S",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'T')::integer AS "T",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'U')::integer AS "U",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'V')::integer AS "V",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'W')::integer AS "W",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'X')::integer AS "X",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'Y')::integer AS "Y",
	COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) = 'Z')::integer AS "Z",
	COUNT(*) FILTER (
		WHERE p."id" IS NOT NULL AND upper(left(coalesce(p."diagnosis_code", ''), 1)) !~ '^[A-Z]$'
	)::integer AS "Other",
	c."day_after_holiday",
	c."is_holiday",
	c."holiday_streak_len",
	c."days_since_streak_end",
	c."post_streak_surge",
	c."month_sin",
	c."month_cos"
FROM "users" u
CROSS JOIN "calendar" c
LEFT JOIN "patients" p
	ON p."hospital_id" = u."id"
	AND p."visit_date_str" = c."date_str"
GROUP BY
	u."id",
	c."date_str",
	c."day_after_holiday",
	c."is_holiday",
	c."holiday_streak_len",
	c."days_since_streak_end",
	c."post_streak_surge",
	c."month_sin",
	c."month_cos";
