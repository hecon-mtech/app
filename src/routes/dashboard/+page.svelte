<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import Card from '$lib/components/Card.svelte';
	import MetricCard from '$lib/components/MetricCard.svelte';
	import TableCard from '$lib/components/TableCard.svelte';
	import { selectedBaseDate, selectedWeek } from '$lib/stores/dateRange';
	import DrugSelect from '$lib/components/DrugSelect.svelte';

	export let data: PageData;

	const { summary, orders, drugOptions, hospitalId, defaultDrugId } = data;
	const allDrugOptions = drugOptions;
	const stockOrderColumns = [
		{ id: 'item', label: '약품' },
		{ id: 'currentStock', label: '현재' },
		{ id: 'orderedQty', label: '주문' },
		{ id: 'orderedAt', label: '주문일' },
		{ id: 'cartAction', label: '장바구니에 넣기', type: 'action' as const }
	];

	let activityCanvas: HTMLCanvasElement | null = null;
	let occupancyCanvas: HTMLCanvasElement | null = null;
	let activityChart: Chart | null = null;
	let occupancyChart: Chart | null = null;
	let lineChartReady = false;
	let selectedDrugId = defaultDrugId;
	let lastFetchKey = '';
	let lastOptionFetchKey = '';
	let hasLineData = true;
	let noDataLabel = '';
	let filteredDrugOptions = allDrugOptions;
	$: selectedDrug = filteredDrugOptions.find((drug) => drug.id === selectedDrugId);
	$: baseDateKey = toDateKey($selectedBaseDate);

	const toDateKey = (date: Date) => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	};

	const formatLabel = (dateKey: string) => {
		const [, month, day] = dateKey.split('-');
		return `${month}/${day}`;
	};

	const getLineFetchKey = (selectedBaseDateKey: string) =>
		`${selectedDrugId}-${toDateKey($selectedWeek.start)}-${toDateKey($selectedWeek.end)}-${selectedBaseDateKey}`;

	const updateLineChart = (payload: {
		labels: string[];
		actual: (number | null)[];
		prediction: (number | null)[];
		upper: (number | null)[];
		lower: (number | null)[];
	}) => {
		if (!occupancyChart) return;
		occupancyChart.data.labels = payload.labels.map(formatLabel);
		occupancyChart.data.datasets[0].data = payload.lower;
		occupancyChart.data.datasets[1].data = payload.upper;
		occupancyChart.data.datasets[2].data = payload.actual;
		occupancyChart.data.datasets[3].data = payload.prediction;
		occupancyChart.update();
	};

	const fetchLineData = async () => {
		if (!selectedDrugId) {
			hasLineData = false;
			noDataLabel = '선택 가능한 약품이 없습니다.';
			return;
		}
		const start = $selectedWeek.start;
		const end = $selectedWeek.end;
		const actualEnd = new Date($selectedBaseDate);

		const params = new URLSearchParams({
			hospitalId,
			drugId: selectedDrugId,
			start: toDateKey(start),
			end: toDateKey(end),
			actualEnd: toDateKey(actualEnd)
		});

		const response = await fetch(`/api/usage-forecast?${params.toString()}`);
		if (!response.ok) return;
		const payload = await response.json();
		const hasAny =
			payload.actual.some((value: number | null) => value !== null) ||
			payload.prediction.some((value: number | null) => value !== null);
		hasLineData = hasAny;
		noDataLabel = hasAny
			? ''
			: selectedDrug
				? `${selectedDrug.name} (${selectedDrug.id})`
				: selectedDrugId;
		updateLineChart(payload);
	};

	const fetchAvailableDrugOptions = async () => {
		const start = $selectedWeek.start;
		const end = $selectedWeek.end;
		const params = new URLSearchParams({
			hospitalId,
			start: toDateKey(start),
			end: toDateKey(end)
		});
		const response = await fetch(`/api/usage-forecast/drug-options?${params.toString()}`);

		if (!response.ok) {
			filteredDrugOptions = allDrugOptions;
			return;
		}

		const payload = await response.json();
		const availableDrugIds = new Set<string>(payload.drugIds ?? []);
		filteredDrugOptions = allDrugOptions.filter((option) => availableDrugIds.has(option.id));

		if (!filteredDrugOptions.some((option) => option.id === selectedDrugId)) {
			selectedDrugId = filteredDrugOptions[0]?.id ?? '';
		}
	};

	onMount(() => {
		Chart.register(...registerables);

		if (activityCanvas) {
			activityChart = new Chart(activityCanvas, {
				type: 'bar',
				data: {
					labels: ['00시', '04시', '08시', '12시', '16시', '20시'],
					datasets: [
						{
							label: '내원',
							data: [12, 9, 18, 26, 22, 15],
							backgroundColor: 'rgba(136, 180, 250, 0.75)',
							borderRadius: 6
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: { legend: { display: false } },
					scales: {
						y: { ticks: { precision: 0 }, grid: { color: 'rgba(162, 191, 254, 0.2)' } },
						x: { grid: { display: false } }
					}
				}
			});
		}

		if (occupancyCanvas) {
			occupancyChart = new Chart(occupancyCanvas, {
				type: 'line',
				data: {
					labels: [],
					datasets: [
						{
							label: '예측 범위 하한',
							data: [],
							borderColor: 'rgba(0, 0, 0, 0)',
							backgroundColor: 'rgba(0, 0, 0, 0)',
							pointRadius: 0,
							tension: 0.35,
							fill: false
						},
						{
							label: '예측 범위',
							data: [],
							borderColor: 'rgba(162, 191, 254, 0)',
							backgroundColor: 'rgba(162, 191, 254, 0.18)',
							pointRadius: 0,
							tension: 0.35,
							fill: '-1'
						},
						{
							label: '실제',
							data: [],
							borderColor: 'rgba(107, 149, 232, 0.95)',
							backgroundColor: 'rgba(107, 149, 232, 0.2)',
							tension: 0.35,
							fill: false
						},
						{
							label: '예측',
							data: [],
							borderColor: 'rgba(162, 191, 254, 0.95)',
							backgroundColor: 'rgba(162, 191, 254, 0.12)',
							borderDash: [6, 4],
							tension: 0.35,
							fill: false
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: 'bottom',
							labels: {
								filter: (item) => item.text !== '예측 범위 하한'
							}
						}
					},
					scales: {
						y: { ticks: { precision: 0 } },
						x: { grid: { display: false } }
					}
				}
			});
			lastOptionFetchKey = `${toDateKey($selectedWeek.start)}-${toDateKey($selectedWeek.end)}`;
			fetchAvailableDrugOptions().then(() => {
				lineChartReady = true;
				lastFetchKey = getLineFetchKey(baseDateKey);
				if (selectedDrugId) {
					fetchLineData();
				} else {
					hasLineData = false;
					noDataLabel = '선택 가능한 약품이 없습니다.';
				}
			});
		}

		return () => {
			activityChart?.destroy();
			occupancyChart?.destroy();
		};
	});

	$: if (lineChartReady && selectedDrugId) {
		const nextKey = getLineFetchKey(baseDateKey);
		if (nextKey !== lastFetchKey) {
			lastFetchKey = nextKey;
			fetchLineData();
		}
	}

	$: if (lineChartReady) {
		const nextOptionsKey = `${toDateKey($selectedWeek.start)}-${toDateKey($selectedWeek.end)}`;
		if (nextOptionsKey !== lastOptionFetchKey) {
			lastOptionFetchKey = nextOptionsKey;
			fetchAvailableDrugOptions();
		}
	}
</script>

<section class="grid-4">
	{#each summary.metrics as metric, index}
		{#if index === summary.metrics.length - 1}
			<div class="card metric-card">
				<div class="muted">약품 선택</div>
				<DrugSelect options={filteredDrugOptions} bind:value={selectedDrugId} />
			</div>
		{:else}
			<MetricCard label={metric.label} value={metric.value} delta={metric.delta} status={metric.status} />
		{/if}
	{/each}
</section>

<section class="grid-2">
	<Card title="활동 추이" subtitle="시간대별 환자 유입 스냅샷.">
		<div style="height: 240px; margin-top: 12px;">
			<canvas bind:this={activityCanvas}></canvas>
		</div>
	</Card>
	<Card title="약품 사용량" subtitle="실제 사용량과 예측 범위">
		<div class:chart-empty={!hasLineData} class="line-chart-wrap">
			<canvas bind:this={occupancyCanvas}></canvas>
			{#if !hasLineData}
				<div class="chart-empty-overlay">No available data for {noDataLabel}.</div>
			{/if}
		</div>
	</Card>
</section>

<section class="stock-monitoring">
	<TableCard
		title="재고 모니터링"
		subtitle="현재 재고가 낮은 순 상위 10개 약품의 재고/주문 현황"
		columns={stockOrderColumns}
		rows={orders}
	/>
</section>

<style>
	.stock-monitoring :global(.table th) {
		text-align: center;
	}

	.stock-monitoring :global(.table th:first-child),
	.stock-monitoring :global(.table td:first-child) {
		max-width: 495px;
		width: 495px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stock-monitoring :global(.table-action-btn) {
		display: block;
		margin: 0 auto;
	}
</style>
