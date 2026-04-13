import { writable } from 'svelte/store';

export type AlarmItem = {
	id: string;
	title: string;
	preview: string;
	detail: string;
	level: 'ok' | 'info' | 'warn';
	action?: 'open-order-modal';
	targetDrugId?: string;
	targetLabel?: string;
};

const fallbackAlarmItems: AlarmItem[] = [
	{
		id: 'system-status',
		title: '시스템 상태',
		preview: 'DB 동기화 대기 중',
		detail: '실시간 상태 데이터를 불러오는 중입니다.',
		level: 'info'
	}
];

const alarmItems = writable<AlarmItem[]>(fallbackAlarmItems);

const setAlarmItems = (items: AlarmItem[]) => {
	alarmItems.set(items.length > 0 ? items : fallbackAlarmItems);
};

export { alarmItems, setAlarmItems };
