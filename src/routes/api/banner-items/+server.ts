import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { drizzleDb } from '$lib/server/db';
import { auctionRegInventory } from '$lib/server/db/schema';
import { and, eq, gt, inArray } from 'drizzle-orm';

const toMinuteLabel = (date: Date) => {
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes}`;
};

export const GET: RequestHandler = async ({ locals }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';
	const orders = await db.getRecentOrders(hospitalId);
	const now = new Date();

	const items = [] as Array<{
		id: string;
		title: string;
		preview: string;
		detail: string;
		level: 'ok' | 'info' | 'warn';
		action?: 'open-order-modal';
		targetDrugId?: string;
		targetLabel?: string;
	}>;

	const toNumeric = (value: string) => {
		const normalized = String(value ?? '').replace(/,/g, '').trim();
		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : null;
	};

	const alarmRows = orders.filter((row) => {
		const currentStock = toNumeric(row.currentStock);
		const nextWeekBest = toNumeric(row.nextWeekBest);
		const nextWeekWorst = toNumeric(row.nextWeekWorst);
		return (
			(currentStock !== null && currentStock <= 0) ||
			(nextWeekBest !== null && nextWeekBest <= 0) ||
			(nextWeekWorst !== null && nextWeekWorst <= 0)
		);
	});

	const alarmDrugIds = Array.from(new Set(alarmRows.map((row) => row.drugId)));
	const activeOrderRows =
		alarmDrugIds.length > 0
			? await drizzleDb
					.select({ drugId: auctionRegInventory.drugId })
					.from(auctionRegInventory)
					.where(
						and(
							eq(auctionRegInventory.hospitalId, hospitalId),
							inArray(auctionRegInventory.drugId, alarmDrugIds),
							gt(auctionRegInventory.expireAt, now)
						)
					)
			: [];

	const activeDrugIds = new Set(activeOrderRows.map((row) => row.drugId));

	for (const row of alarmRows) {
		if (activeDrugIds.has(row.drugId)) {
			continue;
		}

		items.push({
			id: `stock-risk-${row.drugId}`,
			title: '재고/예측 경보',
			preview: `${row.item} (현재 ${row.currentStock}, best ${row.nextWeekBest}, worst ${row.nextWeekWorst})`,
			detail: `${row.item}의 재고 또는 다음주 재고 예상이 0 이하입니다. 눌러서 상세 주문 모달을 열고 즉시 주문을 등록하세요.`,
			level: 'warn',
			action: 'open-order-modal',
			targetDrugId: row.drugId,
			targetLabel: row.item
		});
	}

	items.push(
		{
			id: 'system-status',
			title: '시스템 상태',
			preview: `DB 동기화 정상 (${toMinuteLabel(now)} 기준)`,
			detail: `병원 ${hospitalId} 데이터 기준으로 ${toMinuteLabel(now)}에 상태를 갱신했습니다.`,
			level: 'ok'
		},
		{
			id: 'system-sync',
			title: '동기화 알림',
			preview: '1분 주기 API polling 및 DB 상태 점검 중',
			detail: '배너 스토어는 1분마다 서버 API를 호출해 최신 재고 소진 경보 및 운영 상태를 반영합니다.',
			level: 'info'
		}
	);

	return json({ items });
};
