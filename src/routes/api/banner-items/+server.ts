import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db, drizzleDb } from '$lib/server/db';
import { hospitals } from '$lib/server/db/schema';

const toMinuteLabel = (date: Date) => {
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes}`;
};

export const GET: RequestHandler = async () => {
	const hospitalRows = await drizzleDb.select({ id: hospitals.id }).from(hospitals).limit(1);
	const hospitalId = hospitalRows[0]?.id ?? 'HOSP0001';
	const summary = await db.getDashboardSummary(hospitalId);
	const stockoutItems = summary.inventory.filter((item) => item.status === 'warn' || item.status === 'urgent');
	const now = new Date();

	const items = [] as Array<{
		id: string;
		title: string;
		preview: string;
		detail: string;
		level: 'ok' | 'info' | 'warn';
	}>;

	if (stockoutItems.length > 0) {
		const names = stockoutItems.map((item) => item.item.replace(/\s*\([^)]*\)\s*$/, ''));
		items.push({
			id: 'stockout-warning',
			title: '재고 소진 경보',
			preview: `${names.join(', ')}`,
			detail: stockoutItems.map((item) => `${item.item}: ${item.value}`).join(' / '),
			level: 'warn'
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
