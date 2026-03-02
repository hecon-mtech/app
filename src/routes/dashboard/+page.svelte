<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import type { ECharts } from 'echarts';
	import Card from '$lib/components/Card.svelte';
	import TableCard from '$lib/components/TableCard.svelte';
	import { selectedBaseDate, selectedWeek } from '$lib/stores/dateRange';
	import DrugSelect from '$lib/components/DrugSelect.svelte';

	export let data: PageData;
	type PieDatum = { name: string; value: number };
	type WaitPieCharts = {
		visitType: PieDatum[];
		weekday: PieDatum[];
		ageBuckets: PieDatum[];
	};
	type ActivityTrend = {
		labels: string[];
		accuracy: number[];
	};

	const { orders, drugOptions, waitPieCharts, activityTrend, hospitalId, defaultDrugId } = data as PageData & {
		waitPieCharts: WaitPieCharts;
		activityTrend: ActivityTrend;
	};
	const waitPieSlides = [
		{
			title: '외래/입원 환자 비중',
			subtitle: '고유 (patient, date) 기준',
			data: waitPieCharts.visitType
		},
		{
			title: '요일별 환자 비중',
			subtitle: '입원+외래 고유 (patient, date)',
			data: waitPieCharts.weekday
		},
		{
			title: '연령대 환자 비중',
			subtitle: '입원+외래, 10년 단위 버킷',
			data: waitPieCharts.ageBuckets
		}
	];
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
	let waitPieCanvas: HTMLDivElement | null = null;
	let activityChart: Chart | null = null;
	let occupancyChart: Chart | null = null;
	let waitPieChart: ECharts | null = null;
	let lineChartReady = false;
	let waitPieIndex = 0;
	let waitPieInterval: ReturnType<typeof setInterval> | null = null;
	let waitPieResizeHandler: (() => void) | null = null;
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

	const renderWaitPie = () => {
		if (!waitPieChart) return;
		const slide = waitPieSlides[waitPieIndex];
		const total = slide.data.reduce((sum: number, item: PieDatum) => sum + item.value, 0);
		waitPieChart.setOption({
			animationDuration: 600,
			tooltip: {
				trigger: 'item',
				formatter: '{b}: {c} ({d}%)'
			},
			legend: {
				orient: 'vertical',
				right: 8,
				top: 'center',
				data: slide.data.map((d) => d.name),
				itemWidth: 14,
				itemGap: 12,
				textStyle: {
					fontSize: 12,
					fontFamily: 'Noto Sans KR, sans-serif'
				}
			},
			series: [
				{
					type: 'pie',
					radius: ['40%', '62%'],
					center: ['42%', '50%'],
					minAngle: 2,
					itemStyle: {
						borderColor: '#ffffff',
						borderWidth: 2
					},
					label: {
						show: false
					},
					emphasis: {
						scale: true,
						scaleSize: 8
					},
					data: slide.data
				}
			],
			graphic:
				total === 0
					? [
							{
								type: 'text',
								left: 'center',
								top: 'center',
								style: {
									text: '데이터 없음',
									fill: '#6b7a8c',
									font: '500 13px Noto Sans KR'
								}
							}
						]
					: []
		});
	};

	const setWaitPieIndex = (index: number) => {
		waitPieIndex = index;
		renderWaitPie();
	};

		onMount(() => {
		Chart.register(...registerables);
		import('echarts').then((echarts) => {
			if (!waitPieCanvas) return;
			waitPieChart = echarts.init(waitPieCanvas);
			renderWaitPie();
			waitPieInterval = setInterval(() => {
				waitPieIndex = (waitPieIndex + 1) % waitPieSlides.length;
				renderWaitPie();
			}, 5000);
			waitPieResizeHandler = () => waitPieChart?.resize();
			window.addEventListener('resize', waitPieResizeHandler);
		});

		if (activityCanvas) {
			activityChart = new Chart(activityCanvas, {
				type: 'bar',
				data: {
					labels: activityTrend.labels,
					datasets: [
						{
							label: '주차별 평균 정확도(%)',
							data: activityTrend.accuracy,
							backgroundColor: 'rgba(136, 180, 250, 0.75)',
							borderRadius: 6,
							order: 1
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: { legend: { display: false } },
					scales: {
						y: {
							min: 0,
							max: 100,
							ticks: { callback: (value) => `${value}%` },
							grid: { color: 'rgba(162, 191, 254, 0.2)' }
						},
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
							borderColor: 'rgba(52, 101, 212, 0.42)',
							backgroundColor: 'rgba(52, 101, 212, 0.06)',
							pointRadius: 0,
							borderWidth: 1,
							tension: 0.35,
							fill: false
						},
						{
							label: '예측 범위',
							data: [],
							borderColor: 'rgba(52, 101, 212, 0.62)',
							backgroundColor: 'rgba(52, 101, 212, 0.3)',
							pointRadius: 0,
							borderWidth: 1,
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
			waitPieChart?.dispose();
			if (waitPieInterval) {
				clearInterval(waitPieInterval);
			}
			if (waitPieResizeHandler) {
				window.removeEventListener('resize', waitPieResizeHandler);
			}
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

<section class="dashboard-priority-grid">
	<div class="card metric-card wait-pie-card patient-info-card">
		<div class="metric-header">
			<div class="muted">환자 정보</div>
			<div class="pill">{waitPieIndex + 1}/3</div>
		</div>
		<div class="wait-pie-title">{waitPieSlides[waitPieIndex].title}</div>
		<div class="muted wait-pie-subtitle">{waitPieSlides[waitPieIndex].subtitle}</div>
		<div class="wait-pie-canvas-wrap">
			<div class="wait-pie-canvas" bind:this={waitPieCanvas}></div>
		</div>
		<div class="wait-pie-dots">
			{#each waitPieSlides as _slide, pieIndex}
				<button
					type="button"
					class:active={pieIndex === waitPieIndex}
					on:click={() => setWaitPieIndex(pieIndex)}
					aria-label={`Switch to pie chart ${pieIndex + 1}`}
				></button>
			{/each}
		</div>
	</div>

	<div class="accuracy-panel">
		<Card title="최근 4주 평균 모델 정확도" subtitle="실사용량 <= 예측 상한이면 정확(약품별 주간 평균 후 주차 평균)">
			<div class="accuracy-chart-wrap">
				<canvas bind:this={activityCanvas}></canvas>
			</div>
		</Card>
	</div>

	<div class="usage-panel">
		<div class="card usage-card">
			<div class="usage-card-header">
				<div>
					<h3>약품 사용량</h3>
					<p class="muted">실제 사용량과 예측 범위</p>
				</div>
				<div class="usage-select-wrap">
					<DrugSelect options={filteredDrugOptions} bind:value={selectedDrugId} />
				</div>
			</div>
			<div class:chart-empty={!hasLineData} class="line-chart-wrap">
				<canvas bind:this={occupancyCanvas}></canvas>
				{#if !hasLineData}
					<div class="chart-empty-overlay">No available data for {noDataLabel}.</div>
				{/if}
			</div>
		</div>
	</div>
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
	.stock-monitoring {
		min-width: 0;
	}

	.stock-monitoring :global(.table th) {
		text-align: center;
	}

	.stock-monitoring :global(.table th:first-child),
	.stock-monitoring :global(.table td:first-child) {
		max-width: min(400px, 45vw);
		min-width: 120px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stock-monitoring :global(.table-action-btn) {
		display: block;
		margin: 0 auto;
	}

	.wait-pie-card {
		gap: 6px;
	}

	.dashboard-priority-grid {
		display: grid;
		grid-template-columns: minmax(250px, 0.6fr) minmax(0, 0.85fr);
		grid-template-rows: auto auto;
		gap: 20px;
		align-items: stretch;
		width: 100%;
		max-width: 100%;
		overflow-x: hidden;
	}

	.dashboard-priority-grid > * {
		min-width: 0;
	}

	.patient-info-card {
		grid-column: 1;
		grid-row: 1 / span 2;
		min-height: 380px;
	}

	.accuracy-panel {
		grid-column: 2;
		grid-row: 1;
	}

	.usage-panel {
		grid-column: 2;
		grid-row: 2;
	}

	.usage-panel :global(.line-chart-wrap) {
		height: 180px;
	}

	.accuracy-chart-wrap {
		height: 180px;
		margin-top: 12px;
	}

	.usage-card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 12px;
	}

	.usage-card-header h3 {
		margin: 0 0 8px;
		font-size: 1.05rem;
	}

	.usage-card-header .muted {
		margin-bottom: 0;
	}

	.usage-select-wrap {
		flex-shrink: 0;
		width: min(360px, 100%);
	}

	.wait-pie-title {
		font-size: 0.98rem;
		font-weight: 600;
		line-height: 1.2;
	}

	.wait-pie-subtitle {
		font-size: 0.78rem;
	}

	.wait-pie-canvas-wrap {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
	}

	.wait-pie-canvas {
		height: 300px;
		width: 300px;
		max-width: 100%;
		margin: 0 auto;
	}

	.wait-pie-dots {
		display: flex;
		justify-content: center;
		gap: 8px;
	}

	.wait-pie-dots button {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		border: none;
		background: rgba(107, 122, 140, 0.35);
		padding: 0;
		cursor: pointer;
	}

	.wait-pie-dots button.active {
		background: rgba(107, 149, 232, 0.95);
	}

	@media (max-width: 1080px) {
		.dashboard-priority-grid {
			grid-template-columns: minmax(220px, 0.7fr) minmax(0, 0.85fr);
		}

		.wait-pie-canvas {
			height: 260px;
			width: 260px;
		}
	}

	@media (max-width: 720px) {
		.dashboard-priority-grid {
			grid-template-columns: 1fr;
			grid-template-rows: auto;
		}

		.patient-info-card,
		.accuracy-panel,
		.usage-panel {
			grid-column: 1;
			grid-row: auto;
		}

		.patient-info-card {
			min-height: 320px;
		}

		.wait-pie-canvas {
			height: 240px;
			width: 240px;
		}

		.usage-card-header {
			flex-direction: column;
			align-items: stretch;
		}

		.usage-select-wrap {
			width: 100%;
		}
	}
</style>
