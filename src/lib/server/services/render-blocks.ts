import type { AssistantPayload, ChatRenderBlock } from '$lib/chat/render-blocks';

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
		}
	}

	return blocks;
};

export const withRenderBlocks = (payload: AssistantPayload): AssistantPayload => ({
	...payload,
	renderBlocks: buildRenderBlocksFromToolTrace(payload.toolTrace ?? [])
});
