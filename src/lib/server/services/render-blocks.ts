import type { AssistantPayload, ChatRenderBlock } from '$lib/chat/render-blocks';
import type { PatientSummary } from './patients';
import type { RecentInventorySummary, InventoryPrediction, OrderSuggestionResult } from './inventory-summary';

const escapeHtml = (value: unknown) =>
	String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

const toChartPath = (points: Array<number | null>, width: number, height: number, min: number, max: number) => {
	const usable = points
		.map((value, index) => ({ value, index }))
		.filter((point): point is { value: number; index: number } => isFiniteNumber(point.value));

	if (usable.length === 0) return '';

	const range = max - min || 1;
	return usable
		.map(({ value, index }, pointIndex) => {
			const x = usable.length === 1 ? width / 2 : (index / Math.max(points.length - 1, 1)) * width;
			const y = height - ((value - min) / range) * height;
			return `${pointIndex === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
		})
		.join(' ');
};

const buildForecastHtmlBlock = (result: Record<string, unknown>) => {
	const labels = Array.isArray(result.labels) ? result.labels.map((value) => String(value)) : [];
	const actual = Array.isArray(result.actual) ? result.actual.map((value) => (typeof value === 'number' ? value : null)) : [];
	const prediction = Array.isArray(result.prediction)
		? result.prediction.map((value) => (typeof value === 'number' ? value : null))
		: [];
	const upper = Array.isArray(result.upper) ? result.upper.map((value) => (typeof value === 'number' ? value : null)) : [];
	const lower = Array.isArray(result.lower) ? result.lower.map((value) => (typeof value === 'number' ? value : null)) : [];

	if (labels.length === 0) return null;

	const values = [...actual, ...prediction, ...upper, ...lower].filter(isFiniteNumber);
	if (values.length === 0) return null;

	const width = 720;
	const height = 220;
	const min = Math.min(...values);
	const max = Math.max(...values);
	const labelStep = Math.max(1, Math.ceil(labels.length / 6));

	return `
		<div class="tool-graph-card">
			<div class="tool-graph-header">
				<div>
					<div class="tool-graph-kicker">Forecast</div>
					<h4>사용량 / 예측 시계열</h4>
				</div>
				<div class="tool-graph-legend">
					<span><i class="actual"></i>Actual</span>
					<span><i class="prediction"></i>Prediction</span>
					<span><i class="upper"></i>Upper</span>
					<span><i class="lower"></i>Lower</span>
				</div>
			</div>
			<svg viewBox="0 0 ${width} ${height}" class="tool-graph-svg" role="img" aria-label="usage forecast chart">
				<path d="${toChartPath(lower, width, height, min, max)}" class="lower-line"></path>
				<path d="${toChartPath(upper, width, height, min, max)}" class="upper-line"></path>
				<path d="${toChartPath(prediction, width, height, min, max)}" class="prediction-line"></path>
				<path d="${toChartPath(actual, width, height, min, max)}" class="actual-line"></path>
			</svg>
			<div class="tool-graph-axis">
				${labels
					.map((label, index) =>
						index % labelStep === 0 || index === labels.length - 1
							? `<span>${escapeHtml(label)}</span>`
							: '<span></span>'
					)
					.join('')}
			</div>
		</div>
	`;
};

const toTableBlock = (id: string, title: string, result: Record<string, unknown>) => {
	const columns = Array.isArray(result.columns) ? result.columns.map((value) => String(value)) : [];
	const rows = Array.isArray(result.rows)
		? result.rows.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object')
		: [];

	if (columns.length === 0 || rows.length === 0) return null;

	return {
		id,
		type: 'table',
		title,
		columns,
		rows
	} satisfies ChatRenderBlock;
};

const buildPatientEChartsBlocks = (result: PatientSummary, index: number): ChatRenderBlock[] => [
	{
		id: `patient-line-${index}`,
		type: 'echarts',
		title: '일별 방문자 추이',
		option: {
			tooltip: { trigger: 'axis' },
			legend: { data: ['입원', '외래'] },
			xAxis: { type: 'category', data: result.byDate.map((d) => d.date) },
			yAxis: { type: 'value', minInterval: 1 },
			series: [
				{ name: '입원', type: 'line', data: result.byDate.map((d) => d.inpatient), smooth: true },
				{ name: '외래', type: 'line', data: result.byDate.map((d) => d.outpatient), smooth: true }
			]
		}
	},
	{
		id: `patient-pie-${index}`,
		type: 'echarts',
		title: '입원 / 외래 비율',
		option: {
			tooltip: { trigger: 'item', formatter: '{b}: {c}명 ({d}%)' },
			series: [
				{
					type: 'pie',
					radius: '60%',
					data: [
						{ name: '입원', value: result.total.inpatient },
						{ name: '외래', value: result.total.outpatient }
					]
				}
			]
		}
	},
	{
		id: `patient-bar-${index}`,
		type: 'echarts',
		title: '진료과별 방문자',
		option: {
			tooltip: { trigger: 'axis' },
			legend: { data: ['입원', '외래'] },
			xAxis: { type: 'category', data: result.byDepartment.map((d) => d.dept), axisLabel: { rotate: 30 } },
			yAxis: { type: 'value', minInterval: 1 },
			series: [
				{ name: '입원', type: 'bar', data: result.byDepartment.map((d) => d.inpatient) },
				{ name: '외래', type: 'bar', data: result.byDepartment.map((d) => d.outpatient) }
			]
		}
	}
];

const isPatientSummary = (result: Record<string, unknown>): result is PatientSummary =>
	typeof result.period === 'object' &&
	typeof result.total === 'object' &&
	Array.isArray(result.byDepartment) &&
	Array.isArray(result.byDate);

const truncate = (text: string, max: number) =>
	text.length > max ? text.slice(0, max) + '…' : text;

const isRecentInventory = (result: Record<string, unknown>): result is RecentInventorySummary =>
	typeof result.period === 'object' &&
	typeof result.totalDrugs === 'number' &&
	Array.isArray(result.byDrug);

const isInventoryPrediction = (result: Record<string, unknown>): result is InventoryPrediction =>
	typeof result.drugCode === 'string' &&
	typeof result.period === 'object' &&
	Array.isArray(result.byDateSeries);

const isOrderSuggestionResult = (result: Record<string, unknown>): result is OrderSuggestionResult =>
	typeof result.predictionStartDate === 'string' &&
	Array.isArray(result.suggestions);

const buildOrderSuggestionBlock = (result: OrderSuggestionResult, index: number): ChatRenderBlock | null => {
	if (result.suggestions.length === 0) return null;
	return {
		id: `order-suggest-${index}`,
		type: 'table',
		title: `발주 제안 — 기준일 ${result.predictionStartDate}`,
		columns: ['약품명', '향후예측사용량', '권장발주량'],
		rows: result.suggestions.map((s) => ({
			약품명: truncate(s.drugName, 20),
			향후예측사용량: s.futurePredictionSum,
			권장발주량: s.suggestedOrder
		}))
	};
};

const buildSingleOrderSuggestionBlock = (
	suggestion: InventoryPrediction['orderSuggestion'],
	index: number
): ChatRenderBlock | null => {
	if (!suggestion) return null;
	return {
		id: `inventory-pred-order-${index}`,
		type: 'table',
		title: `발주 제안 — ${truncate(suggestion.drugName, 20)} (${suggestion.drugCode})`,
		columns: ['약품명', '향후예측사용량', '권장발주량'],
		rows: [
			{
				약품명: truncate(suggestion.drugName, 20),
				향후예측사용량: suggestion.futurePredictionSum,
				권장발주량: suggestion.suggestedOrder
			}
		]
	};
};

const buildRecentInventoryBlock = (result: RecentInventorySummary, index: number): ChatRenderBlock => {
	const periodLabel = `${result.period.start} ~ ${result.period.end}`;
	const topDrugs = result.byDrug.slice(0, 15);
	return {
		id: `inventory-table-${index}`,
		type: 'table',
		title: `약품별 사용량 (상위) — ${periodLabel}`,
		columns: ['순위', '약품명', '사용량', '현재고'],
		rows: topDrugs.map((d, i) => ({
			순위: i + 1,
			약품명: truncate(d.drugName, 20),
			사용량: d.totalFlow,
			현재고: d.latestStock ?? '-'
		}))
	};
};

const buildInventoryPredictionBlock = (result: InventoryPrediction, index: number): ChatRenderBlock => {
	const periodLabel = `${result.period.start} ~ ${result.period.end}`;
	const round = (v: number | null) => (v != null ? Math.round(v) : null);
	const dates = result.byDateSeries.map((d) => d.date);
	const actual = result.byDateSeries.map((d) => round(d.actual));
	const prediction = result.byDateSeries.map((d) => round(d.prediction));
	const predLower = result.byDateSeries.map((d) => round(d.predictionLower));
	const bandDiff = result.byDateSeries.map((d) =>
		d.predictionUpper != null && d.predictionLower != null
			? Math.round(d.predictionUpper) - Math.round(d.predictionLower)
			: null
	);

	return {
		id: `inventory-pred-${index}`,
		type: 'echarts',
		title: `일별 재고 추이 — ${truncate(result.drugName, 20)} (${result.drugCode}) — ${periodLabel}`,
		option: {
			tooltip: { trigger: 'axis' },
			legend: {
				data: ['실제 사용량', '예측', '예측 밴드'],
				selected: { '예측 밴드': false }
			},
			xAxis: {
				type: 'category',
				data: dates,
				axisLabel: { rotate: 30 }
			},
			yAxis: { type: 'value' },
			series: [
				{
					name: '예측 하한',
					type: 'line',
					data: predLower,
					stack: 'pred-band',
					symbol: 'none',
					lineStyle: { opacity: 0 },
					areaStyle: { color: 'transparent' },
					tooltip: { show: false }
				},
				{
					name: '예측 밴드',
					type: 'line',
					data: bandDiff,
					stack: 'pred-band',
					symbol: 'none',
					lineStyle: { opacity: 0 },
					areaStyle: { color: 'rgba(135,206,235,0.35)' }
				},
				{
					name: '예측',
					type: 'line',
					data: prediction,
					symbol: 'none',
					smooth: true,
					lineStyle: { color: '#2563eb', width: 2, type: 'dashed' },
					itemStyle: { color: '#2563eb' }
				},
				{
					name: '실제 사용량',
					type: 'line',
					data: actual,
					symbol: 'circle',
					symbolSize: 5,
					smooth: false,
					lineStyle: { color: '#ef4444', width: 2.5 },
					itemStyle: { color: '#ef4444' }
				}
			]
		}
	};
};

export const buildRenderBlocksFromToolTrace = (toolTrace: Array<Record<string, unknown>>): ChatRenderBlock[] => {
	const blocks: ChatRenderBlock[] = [];

	for (const [index, trace] of toolTrace.entries()) {
		const name = typeof trace.name === 'string' ? trace.name : '';
		const result = trace.result && typeof trace.result === 'object' ? (trace.result as Record<string, unknown>) : null;
		if (!name || !result) continue;

		if (name === 'get_usage_forecast') {
			const html = buildForecastHtmlBlock(result);
			if (html) {
				blocks.push({ id: `forecast-${index}`, type: 'html', title: 'Usage Forecast', html });
			}
			continue;
		}

		if (name === 'list_stock_shortage_orders') {
			const block = toTableBlock(`stock-shortage-${index}`, '부족한 재고 주문 조회', result);
			if (block) blocks.push(block);
			continue;
		}

		if (name === 'get_current_auction_status') {
			const block = toTableBlock(`auction-status-${index}`, '현재 경매 현황', {
				columns: ['title', 'quantity', 'bidCount', 'minBidPriceLabel', 'remainingTimeLabel', 'isExpired'],
				rows: Array.isArray(result.orders)
					? (result.orders as Array<Record<string, unknown>>)
					: []
			});
			if (block) blocks.push(block);
			continue;
		}

		if (name === 'summarize_recent_patients' && isPatientSummary(result)) {
			blocks.push(...buildPatientEChartsBlocks(result, index));
			continue;
		}

		if (name === 'summarize_recent_inventory' && isRecentInventory(result)) {
			blocks.push(buildRecentInventoryBlock(result, index));
			continue;
		}

		if (name === 'inventory_prediction' && isInventoryPrediction(result)) {
			blocks.push(buildInventoryPredictionBlock(result, index));
			const orderBlock = buildSingleOrderSuggestionBlock(result.orderSuggestion, index);
			if (orderBlock) blocks.push(orderBlock);
			continue;
		}

		if (name === 'suggest_order' && isOrderSuggestionResult(result)) {
			const orderBlock = buildOrderSuggestionBlock(result, index);
			if (orderBlock) blocks.push(orderBlock);
			continue;
		}

		if (name === 'search_drugs') {
			const block = toTableBlock(`drug-search-${index}`, '약품 검색 결과', result);
			if (block) blocks.push(block);
			continue;
		}
	}

	return blocks;
};

export const withRenderBlocks = (payload: AssistantPayload): AssistantPayload => ({
	...payload,
	renderBlocks: buildRenderBlocksFromToolTrace(payload.toolTrace ?? [])
});
