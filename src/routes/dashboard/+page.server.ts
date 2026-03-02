import type { PageServerLoad } from './$types';
import { db, drizzleDb } from '$lib/server/db';
import {
	atcCodes,
	currentUsages,
	hospitals,
	inpatientPatients,
	outpatientPatients,
	supplyPredictions
} from '$lib/server/db/schema';
import { asc, desc, eq, gte, sql } from 'drizzle-orm';

const weekdayLabels = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

const toDateKey = (value: Date) => {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const toWeekdayIndex = (value: Date) => {
	const day = value.getDay();
	return day === 0 ? 6 : day - 1;
};

const toAgeBucket = (age: number) => {
	if (age < 10) return '0-10';
	if (age >= 80) return '80+';
	const floor = Math.floor(age / 10) * 10;
	return `${floor}-${floor + 10}`;
};

const ageBuckets = ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80+'];

const shiftDate = (value: Date, days: number) => {
	const next = new Date(value);
	next.setDate(next.getDate() + days);
	return next;
};

export const load: PageServerLoad = async () => {
	const hospitalRows = await drizzleDb.select({ id: hospitals.id }).from(hospitals).limit(1);
	const hospitalId = hospitalRows[0]?.id ?? 'HOSP0001';
	const summary = await db.getDashboardSummary(hospitalId);
	const orders = await db.getRecentOrders(hospitalId);
	const drugOptions = await drizzleDb
		.select({ id: atcCodes.id, name: atcCodes.name })
		.from(atcCodes)
		.orderBy(asc(atcCodes.name));

	const [latestOutpatientRow] = await drizzleDb
		.select({ visitDate: outpatientPatients.visitDate })
		.from(outpatientPatients)
		.orderBy(desc(outpatientPatients.visitDate))
		.limit(1);

	const [latestInpatientRow] = await drizzleDb
		.select({ visitDate: inpatientPatients.visitDate })
		.from(inpatientPatients)
		.orderBy(desc(inpatientPatients.visitDate))
		.limit(1);

	const latestVisitDate =
		latestOutpatientRow && latestInpatientRow
			? latestOutpatientRow.visitDate > latestInpatientRow.visitDate
				? latestOutpatientRow.visitDate
				: latestInpatientRow.visitDate
			: latestOutpatientRow?.visitDate ?? latestInpatientRow?.visitDate ?? new Date();

	const sixMonthsAgo = new Date(latestVisitDate);
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

	const [latestUsageRow] = await drizzleDb
		.select({ date: currentUsages.timestamp })
		.from(currentUsages)
		.where(eq(currentUsages.hospitalId, hospitalId))
		.orderBy(desc(currentUsages.timestamp))
		.limit(1);

	const [latestPredictionRow] = await drizzleDb
		.select({ date: supplyPredictions.time })
		.from(supplyPredictions)
		.where(eq(supplyPredictions.hospitalId, hospitalId))
		.orderBy(desc(supplyPredictions.time))
		.limit(1);

	const latestModelDate =
		latestUsageRow && latestPredictionRow
			? latestUsageRow.date > latestPredictionRow.date
				? latestUsageRow.date
				: latestPredictionRow.date
			: latestUsageRow?.date ?? latestPredictionRow?.date ?? new Date();

	const weekStart = shiftDate(latestModelDate, -27);
	const weekEndExclusive = shiftDate(weekStart, 28);

	const weeklyAccuracyResult = await drizzleDb.execute(sql`
		with daily_actual as (
			select
				drug_id,
				"timestamp"::date as day,
				sum(quantity::numeric) as actual_qty
			from current_usages
			where hospital_id = ${hospitalId}
				and "timestamp" >= ${weekStart}
				and "timestamp" < ${weekEndExclusive}
			group by drug_id, "timestamp"::date
		),
		daily_pred_upper as (
			select
				drug_id,
				"time"::date as day,
				sum(upper::numeric) as pred_upper_qty
			from supply_predictions
			where hospital_id = ${hospitalId}
				and "time" >= ${weekStart}
				and "time" < ${weekEndExclusive}
			group by drug_id, "time"::date
		),
		daily_accuracy as (
			select
				((a.day - ${weekStart}::date) / 7)::int as week_index,
				a.drug_id,
				case when a.actual_qty <= coalesce(p.pred_upper_qty, 0) then 1.0 else 0.0 end as is_accurate
			from daily_actual a
			left join daily_pred_upper p
				on a.drug_id = p.drug_id
				and a.day = p.day
			where a.day >= ${weekStart}::date
				and a.day < ${weekEndExclusive}::date
		),
		drug_week_accuracy as (
			select
				week_index,
				drug_id,
				avg(is_accurate) * 100 as drug_week_accuracy
			from daily_accuracy
			where week_index between 0 and 3
			group by week_index, drug_id
		)
		select
			week_index,
			round(avg(drug_week_accuracy), 1) as weekly_accuracy
		from drug_week_accuracy
		group by week_index
		order by week_index;
	`);

	const weeklyAccuracyRows = (
		Array.isArray(weeklyAccuracyResult)
			? weeklyAccuracyResult
			: 'rows' in weeklyAccuracyResult
				? weeklyAccuracyResult.rows
				: []
	) as Array<{ week_index: number | string; weekly_accuracy: number | string }>;

	const weeklyAccuracy = [0, 0, 0, 0];
	for (const row of weeklyAccuracyRows) {
		const index = Number(row.week_index);
		if (Number.isNaN(index) || index < 0 || index > 3) continue;
		weeklyAccuracy[index] = Number(row.weekly_accuracy);
	}

	const outpatientRows = await drizzleDb
		.select({
			patientId: outpatientPatients.patientId,
			visitDate: outpatientPatients.visitDate,
			age: outpatientPatients.age
		})
		.from(outpatientPatients)
		.where(gte(outpatientPatients.visitDate, sixMonthsAgo));

	const inpatientRows = await drizzleDb
		.select({
			patientId: inpatientPatients.patientId,
			visitDate: inpatientPatients.visitDate,
			age: inpatientPatients.age
		})
		.from(inpatientPatients)
		.where(gte(inpatientPatients.visitDate, sixMonthsAgo));

	const outpatientVisitKeys = new Set<string>();
	const inpatientVisitKeys = new Set<string>();
	const mergedVisitMap = new Map<string, { date: Date; age: number }>();

	for (const row of outpatientRows) {
		const dateKey = toDateKey(row.visitDate);
		const key = `${row.patientId}::${dateKey}`;
		outpatientVisitKeys.add(key);
		if (!mergedVisitMap.has(key)) {
			mergedVisitMap.set(key, { date: row.visitDate, age: row.age });
		}
	}

	for (const row of inpatientRows) {
		const dateKey = toDateKey(row.visitDate);
		const key = `${row.patientId}::${dateKey}`;
		inpatientVisitKeys.add(key);
		if (!mergedVisitMap.has(key)) {
			mergedVisitMap.set(key, { date: row.visitDate, age: row.age });
		}
	}

	const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
	const ageCounts = new Map(ageBuckets.map((bucket) => [bucket, 0]));

	for (const value of mergedVisitMap.values()) {
		const weekdayIndex = toWeekdayIndex(value.date);
		weekdayCounts[weekdayIndex] += 1;
		const bucket = toAgeBucket(value.age);
		ageCounts.set(bucket, (ageCounts.get(bucket) ?? 0) + 1);
	}

	const defaultDrugId = drugOptions[0]?.id ?? '';

	return {
		summary,
		orders,
		drugOptions,
		waitPieCharts: {
			visitType: [
				{ name: '외래 환자', value: outpatientVisitKeys.size },
				{ name: '입원 환자', value: inpatientVisitKeys.size }
			],
			weekday: weekdayLabels.map((name, index) => ({ name, value: weekdayCounts[index] })),
			ageBuckets: ageBuckets.map((name) => ({ name, value: ageCounts.get(name) ?? 0 }))
		},
		activityTrend: {
			labels: ['4 weeks ago', '3 weeks ago', '2 weeks ago', '1 week ago'],
			accuracy: weeklyAccuracy
		},
		hospitalId,
		defaultDrugId
	};
};
