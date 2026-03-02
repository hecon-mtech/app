import { writable } from 'svelte/store';

export type BannerItem = {
	id: string;
	title: string;
	preview: string;
	detail: string;
	level: 'ok' | 'info' | 'warn';
};

const fallbackBannerItems: BannerItem[] = [
	{
		id: 'system-status',
		title: '시스템 상태',
		preview: 'DB 동기화 대기 중',
		detail: '실시간 상태 데이터를 불러오는 중입니다.',
		level: 'info'
	}
];

const bannerItems = writable<BannerItem[]>(fallbackBannerItems);

const setBannerItems = (items: BannerItem[]) => {
	bannerItems.set(items.length > 0 ? items : fallbackBannerItems);
};

export { bannerItems, setBannerItems };
