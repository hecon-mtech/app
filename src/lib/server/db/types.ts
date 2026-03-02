export type Metric = {
	label: string;
	value: string;
	delta: string;
	status: 'ok' | 'warn' | 'urgent';
};

export type ActivityPoint = {
	label: string;
	value: number;
};

export type DashboardSummary = {
	metrics: Metric[];
	activity: ActivityPoint[];
	occupancy: {
		used: number;
		total: number;
	};
	inventory: {
		item: string;
		value: string;
		status: 'ok' | 'warn' | 'urgent';
	}[];
};

export type OrderItem = {
	item: string;
	currentStock: string;
	orderedQty: string;
	orderedAt: string;
	cartAction: string;
};
