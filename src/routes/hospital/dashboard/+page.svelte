<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import * as echarts from 'echarts';
	import Card from '$lib/components/Card.svelte';
	import DrugSelect, { type DrugOption } from '$lib/components/DrugSelect.svelte';
	import { today } from '$lib/stores/today';

	const { data } = $props();

	const { patientSummary, orderSuggestions, initialForecast, auctionStatus } = data;

	/* ── Carousel state ── */
	let carouselIndex = $state(0);
	const chartCount = 2;
	let carouselTimer: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		carouselTimer = setInterval(() => {
			carouselIndex = (carouselIndex + 1) % chartCount;
		}, 5000);
	});

	onDestroy(() => {
		if (carouselTimer) clearInterval(carouselTimer);
	});

	/* ── Patient chart options (matches render-blocks.ts canon) ── */
	const patientTrendOption: Record<string, unknown> = {
		tooltip: { trigger: 'axis' },
		legend: { data: ['입원', '외래'] },
		xAxis: { type: 'category', data: patientSummary.byDate.map((d: { date: string }) => d.date) },
		yAxis: { type: 'value', minInterval: 1 },
		series: [
			{ name: '입원', type: 'line', data: patientSummary.byDate.map((d: { inpatient: number }) => d.inpatient), smooth: true },
			{ name: '외래', type: 'line', data: patientSummary.byDate.map((d: { outpatient: number }) => d.outpatient), smooth: true }
		]
	};

	const deptChartOption: Record<string, unknown> = {
		tooltip: { trigger: 'axis' },
		legend: { data: ['입원', '외래'] },
		xAxis: { type: 'category', data: patientSummary.byDepartment.map((d: { dept: string }) => d.dept), axisLabel: { rotate: 30 } },
		yAxis: { type: 'value', minInterval: 1 },
		series: [
			{ name: '입원', type: 'bar', data: patientSummary.byDepartment.map((d: { inpatient: number }) => d.inpatient) },
			{ name: '외래', type: 'bar', data: patientSummary.byDepartment.map((d: { outpatient: number }) => d.outpatient) }
		]
	};

	const chartOptions = [patientTrendOption, deptChartOption];
	const chartTitles = ['일별 방문자 추이', '진료과별 방문자'];

	/* ── Carousel chart rendering ── */
	let carouselContainer: HTMLDivElement | undefined = $state();
	let carouselChart: echarts.ECharts | undefined;
	let carouselObserver: ResizeObserver | undefined;

	$effect(() => {
		if (carouselContainer && !carouselChart) {
			carouselChart = echarts.init(carouselContainer);
			carouselObserver = new ResizeObserver(() => carouselChart?.resize());
			carouselObserver.observe(carouselContainer);
		}
	});

	$effect(() => {
		if (carouselChart) {
			carouselChart.setOption(chartOptions[carouselIndex], true);
		}
	});

	onDestroy(() => {
		carouselObserver?.disconnect();
		carouselChart?.dispose();
	});

	/* ── Drug forecast chart ── */
	type ForecastData = typeof initialForecast;
	let selectedDrugCode: string | null = $state(initialForecast?.drugCode ?? null);
	let forecastData: ForecastData = $state(initialForecast);
	let forecastLoading = $state(false);

	const drugOptions: DrugOption[] = orderSuggestions.suggestions.map(
		(s: { drugCode: string; drugName: string }) => ({ id: s.drugCode, name: s.drugName })
	);

	let forecastContainer: HTMLDivElement | undefined = $state();
	let forecastChart: echarts.ECharts | undefined;
	let forecastObserver: ResizeObserver | undefined;

	$effect(() => {
		if (forecastContainer && !forecastChart) {
			forecastChart = echarts.init(forecastContainer);
			forecastObserver = new ResizeObserver(() => forecastChart?.resize());
			forecastObserver.observe(forecastContainer);
		}
	});

	const round = (v: number | null) => (v != null ? Math.round(v) : null);

	const buildForecastOption = (fd: ForecastData): Record<string, unknown> => {
		if (!fd) return {};
		const dates = fd.byDateSeries.map((s: { date: string }) => s.date);
		const actual = fd.byDateSeries.map((s: { actual: number | null }) => round(s.actual));
		const prediction = fd.byDateSeries.map((s: { prediction: number | null }) => round(s.prediction));
		const predLower = fd.byDateSeries.map((s: { predictionLower: number | null }) => round(s.predictionLower));
		const bandDiff = fd.byDateSeries.map((s: { predictionUpper: number | null; predictionLower: number | null }) =>
			s.predictionUpper != null && s.predictionLower != null
				? Math.round(s.predictionUpper) - Math.round(s.predictionLower)
				: null
		);

		return {
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
		};
	};

	$effect(() => {
		if (forecastChart && forecastData) {
			forecastChart.setOption(buildForecastOption(forecastData), true);
		}
	});

	onDestroy(() => {
		forecastObserver?.disconnect();
		forecastChart?.dispose();
	});

	const fetchForecast = async (drugCode: string) => {
		forecastLoading = true;
		try {
			const anchor = get(today);
			const end = new Date(anchor);
			end.setDate(end.getDate() + 13);
			const start = new Date(anchor);
			start.setDate(start.getDate() - 14);

			const params = new URLSearchParams({
				hospitalId: 'HOSP0001',
				drugId: drugCode,
				start: toDateStr(start),
				end: toDateStr(end),
				actualEnd: toDateStr(anchor)
			});

			const res = await fetch(`/api/usage-forecast?${params}`);
			if (res.ok) {
				const json = await res.json();
				forecastData = {
					drugCode,
					drugName: orderSuggestions.suggestions.find(
						(s: { drugCode: string }) => s.drugCode === drugCode
					)?.drugName ?? drugCode,
					predictionStartDate: toDateStr(anchor),
					period: { start: toDateStr(start), end: toDateStr(end) },
					byDateSeries: json.labels.map((label: string, i: number) => ({
						date: label,
						actual: json.actual[i],
						prediction: json.prediction[i],
						predictionUpper: json.upper[i],
						predictionLower: json.lower[i]
					})),
					orderSuggestion: null
				};
			}
		} finally {
			forecastLoading = false;
		}
	};

	let prevDrugCode = selectedDrugCode;
	$effect(() => {
		const code = selectedDrugCode;
		if (code && code !== prevDrugCode) {
			prevDrugCode = code;
			fetchForecast(code);
		}
	});

	const toDateStr = (d: Date) => {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	};

	/* ── Order table ── */
	let editableOrders = $state(
		orderSuggestions.suggestions.map((s: { drugCode: string; drugName: string; futurePredictionSum: number; suggestedOrder: number }) => ({
			drugCode: s.drugCode,
			drugName: s.drugName,
			futurePredictionSum: s.futurePredictionSum,
			suggestedOrder: s.suggestedOrder
		}))
	);

	let orderModalOpen = $state(false);

	const handleOrderAll = () => {
		orderModalOpen = true;
	};

	const closeOrderModal = () => {
		orderModalOpen = false;
	};

	const truncate = (text: string, max: number) =>
		text.length > max ? text.slice(0, max) + '…' : text;

	/* ── Tab state ── */
	let activeTab: 'orders' | 'auctions' = $state('orders');

	/* ── Auction urgency timer (updates every 30s) ── */
	let now = $state(Date.now());
	let urgencyTimer: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		now = Date.now();
		urgencyTimer = setInterval(() => { now = Date.now(); }, 30_000);
	});

	onDestroy(() => { if (urgencyTimer) clearInterval(urgencyTimer); });

	const computeRemainingLabel = (diffMs: number): string => {
		if (diffMs <= 0) return '경매 종료';
		const totalMin = Math.max(1, Math.ceil(diffMs / 60000));
		const days = Math.floor(totalMin / 1440);
		const hours = Math.floor((totalMin % 1440) / 60);
		const minutes = totalMin % 60;
		if (days > 0) return `${days}일 ${hours}시간 ${minutes}분`;
		if (hours > 0) return `${hours}시간 ${minutes}분`;
		return `${minutes}분`;
	};

	const auctionCards = $derived(
		(auctionStatus?.orders ?? [])
			.filter((o: { isExpired: boolean }) => !o.isExpired)
			.map((order: { expireAtIso: string; bidCount: number; id: number; title: string; quantity: string; minBidPriceLabel: string; expireAtLabel: string }) => {
				const expireMs = new Date(order.expireAtIso).getTime();
				const remainingMs = expireMs - now;
				const withinOneHour = remainingMs > 0 && remainingMs <= 3_600_000;

				let urgency: 'none' | 'caution' | 'warn' = 'none';
				if (withinOneHour && order.bidCount === 0) urgency = 'warn';
				else if (withinOneHour) urgency = 'caution';

				return { ...order, urgency, remainingLabel: computeRemainingLabel(remainingMs) };
			})
	);
</script>

<div class="dashboard-grid">
	<div class="left-column">
		<Card>
			<div class="chart-header">
				<h3>{chartTitles[carouselIndex]}</h3>
				<div class="carousel-dots">
					{#each chartOptions as _, i}
						<button
							type="button"
							class="dot"
							class:active={carouselIndex === i}
							onclick={() => { carouselIndex = i; }}
							aria-label="차트 {i + 1}"
						></button>
					{/each}
				</div>
			</div>
			<div class="chart-fill" bind:this={carouselContainer}></div>
		</Card>

		<Card>
			<div class="forecast-title scroll-name" title={forecastData ? `약품 사용량 예측 — ${forecastData.drugName}` : '약품 사용량 예측'}>
				<span class="scroll-name-inner">{forecastData ? `약품 사용량 예측 — ${forecastData.drugName}` : '약품 사용량 예측'}</span>
			</div>
			{#if drugOptions.length > 0}
				<div class="drug-selector">
					<DrugSelect options={drugOptions} bind:value={selectedDrugCode} placeholder="약품 검색" />
					{#if forecastLoading}
						<span class="loading-indicator">로딩중...</span>
					{/if}
				</div>
			{/if}
			<div class="chart-fill" bind:this={forecastContainer}></div>
		</Card>
	</div>

	<div class="right-column">
		<Card>
			<div class="table-header">
				<div class="tab-bar">
					<button
						type="button"
						class="tab-btn"
						class:active={activeTab === 'orders'}
						onclick={() => { activeTab = 'orders'; }}
					>권장 발주 물량</button>
					<button
						type="button"
						class="tab-btn"
						class:active={activeTab === 'auctions'}
						onclick={() => { activeTab = 'auctions'; }}
					>
						진행 중 경매
						{#if auctionCards.length > 0}
							<span class="tab-badge">{auctionCards.length}</span>
						{/if}
					</button>
				</div>
				{#if activeTab === 'orders'}
					<button type="button" class="order-all-btn" onclick={handleOrderAll}>전체 주문하기</button>
				{/if}
			</div>

			{#if activeTab === 'orders'}
				<p class="muted tab-subtitle">예측 기반 자동 산출 ({orderSuggestions.predictionStartDate} 기준)</p>
				<div class="order-table-scroll">
					<table class="order-table">
						<thead>
							<tr>
								<th class="col-code">약품코드</th>
								<th class="col-name">약품명</th>
								<th class="col-num">예측 사용량</th>
								<th class="col-num">권장 발주량</th>
							</tr>
						</thead>
						<tbody>
							{#each editableOrders as row, i}
								<tr>
									<td class="col-code"><span class="pill">{row.drugCode}</span></td>
									<td class="col-name">
										<div class="scroll-name" title={row.drugName}>
											<span class="scroll-name-inner">{row.drugName}</span>
										</div>
									</td>
									<td class="col-num">{row.futurePredictionSum}</td>
									<td class="col-num">
										<input
											type="number"
											class="editable-order"
											value={row.suggestedOrder}
											oninput={(e) => { editableOrders[i].suggestedOrder = Number((e.target as HTMLInputElement).value) || 0; }}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="auction-list-scroll">
					{#each auctionCards as auction (auction.id)}
						<div
							class="auction-card"
							class:is-caution={auction.urgency === 'caution'}
							class:is-warn={auction.urgency === 'warn'}
						>
							<div class="auction-card-head">
								<span class="auction-card-title">{auction.title}</span>
								<span class="auction-card-remaining">{auction.remainingLabel}</span>
							</div>
							<div class="auction-card-body">
								<span>수량: {auction.quantity}</span>
								<span>입찰: {auction.bidCount}건</span>
								<span>최저가: {auction.minBidPriceLabel}</span>
							</div>
							<div class="auction-card-footer">
								<span class="auction-card-expire">마감: {auction.expireAtLabel}</span>
							</div>
						</div>
					{:else}
						<p class="muted empty-auctions">진행 중인 경매가 없습니다.</p>
					{/each}
				</div>
			{/if}
		</Card>
	</div>
</div>

{#if orderModalOpen}
	<div class="modal-backdrop" role="presentation" onclick={closeOrderModal}></div>
	<div class="modal-dialog" role="dialog" aria-modal="true" aria-label="발주 확인">
		<header class="modal-head">
			<h3>발주 확인</h3>
		</header>
		<div class="modal-body">
			<p>발주 주문이 접수되었습니다.</p>
		</div>
		<footer class="modal-foot">
			<button type="button" class="modal-ok-btn" onclick={closeOrderModal}>OK</button>
		</footer>
	</div>
{/if}

<style>
	.dashboard-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		height: calc(100vh - 48px);
		max-height: calc(100vh - 48px);
		overflow: hidden;
	}

	.left-column {
		display: grid;
		grid-template-rows: 1fr 1fr;
		gap: 20px;
		min-height: 0;
	}

	.left-column > :global(.card) {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: visible;
	}

	.right-column {
		min-height: 0;
		overflow: hidden;
	}

	.right-column > :global(.card) {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.table-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.table-header h3 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.tab-bar {
		display: flex;
		gap: 0;
	}

	.tab-btn {
		padding: 6px 14px;
		border: none;
		background: none;
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--muted, #6b7a8c);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		transition: color 0.15s, border-color 0.15s;
	}

	.tab-btn.active {
		color: var(--ink, #1f2b3a);
		border-bottom-color: var(--primary-strong, #6b95e8);
	}

	.tab-btn:hover:not(.active) {
		color: var(--ink, #1f2b3a);
	}

	.tab-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 999px;
		background: rgba(135, 206, 235, 0.3);
		color: #2563eb;
		font-size: 0.7rem;
		font-weight: 700;
		margin-left: 4px;
	}

	.tab-subtitle {
		margin: 0 0 8px;
		font-size: 0.78rem;
	}

	.order-all-btn {
		flex-shrink: 0;
		padding: 8px 16px;
		border: none;
		border-radius: 999px;
		background: linear-gradient(135deg, #a2bffe, #7ba0f0);
		color: #fff;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 6px 16px rgba(107, 149, 232, 0.25);
		transition: opacity 0.15s;
	}

	.order-all-btn:hover {
		opacity: 0.88;
	}

	.order-table-scroll {
		flex: 1;
		overflow: auto;
		min-height: 0;
	}

	.order-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
		table-layout: fixed;
	}

	.order-table th,
	.order-table td {
		padding: 8px 6px;
		text-align: left;
		border-bottom: 1px solid rgba(226, 232, 240, 0.7);
		vertical-align: middle;
	}

	.order-table thead th {
		position: sticky;
		top: 0;
		background: var(--bg-glass-strong, rgba(255, 255, 255, 0.75));
		font-weight: 600;
		font-size: 0.78rem;
		color: var(--muted, #6b7a8c);
		z-index: 1;
	}

	.col-code { width: 110px; }
	.col-name { width: 40%; }
	.col-num { width: auto; text-align: center; }
	.order-table td.col-num { text-align: center; }

	.pill {
		display: inline-block;
		padding: 2px 10px;
		border-radius: 999px;
		background: rgba(135, 206, 235, 0.3);
		color: #2563eb;
		font-size: 0.75rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.scroll-name {
		overflow: hidden;
		white-space: nowrap;
		max-width: 100%;
	}

	.scroll-name-inner {
		display: inline-block;
		padding-right: 2em;
	}

	.scroll-name:hover .scroll-name-inner {
		animation: scroll-text 8s linear infinite;
	}

	@keyframes scroll-text {
		0% { transform: translateX(0); }
		100% { transform: translateX(-100%); }
	}

	.forecast-title {
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0 0 8px;
	}

	.editable-order {
		width: 72px;
		padding: 4px 8px;
		border: 1px solid var(--stroke, rgba(200, 210, 220, 0.6));
		border-radius: var(--radius-sm, 8px);
		background: var(--bg-glass, rgba(255, 255, 255, 0.55));
		font-family: inherit;
		font-size: 0.82rem;
		text-align: center;
		color: var(--ink, #1f2b3a);
	}

	.editable-order:focus {
		outline: 2px solid var(--primary-strong, #6b95e8);
		outline-offset: -1px;
	}

	/* Auction cards */
	.auction-list-scroll {
		flex: 1;
		overflow: auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 2px;
	}

	.auction-card {
		padding: 12px 14px;
		border: 1px solid rgba(255, 255, 255, 0.48);
		border-radius: var(--radius, 16px);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(248, 252, 255, 0.35));
		box-shadow: 0 6px 18px rgba(31, 43, 58, 0.06);
	}

	.auction-card.is-caution {
		border-color: rgba(210, 168, 88, 0.38);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(255, 248, 233, 0.18));
		animation: caution-card-blink 1.1s ease-in-out infinite;
	}

	.auction-card.is-warn {
		border-color: rgba(216, 75, 75, 0.34);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(255, 233, 233, 0.18));
		animation: warn-card-blink 1.1s ease-in-out infinite;
	}

	.auction-card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}

	.auction-card-title {
		font-size: 0.85rem;
		font-weight: 700;
	}

	.auction-card-remaining {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--muted, #6b7a8c);
	}

	.auction-card.is-caution .auction-card-remaining {
		color: #a07820;
	}

	.auction-card.is-warn .auction-card-remaining {
		color: #d25858;
	}

	.auction-card-body {
		display: flex;
		gap: 12px;
		font-size: 0.8rem;
		color: rgba(31, 43, 58, 0.76);
	}

	.auction-card-footer {
		margin-top: 6px;
		font-size: 0.75rem;
		color: var(--muted, #6b7a8c);
	}

	.empty-auctions {
		text-align: center;
		padding: 32px 0;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.45);
		z-index: 9000;
	}

	.modal-dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(400px, calc(100vw - 32px));
		z-index: 9001;
		background: #fff;
		border-radius: 18px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		overflow: hidden;
	}

	.modal-head {
		padding: 14px 16px;
		border-bottom: 1px solid rgba(226, 232, 240, 0.9);
	}

	.modal-head h3 {
		margin: 0;
	}

	.modal-body {
		padding: 16px;
	}

	.modal-body p {
		margin: 0;
	}

	.modal-foot {
		padding: 14px 16px;
		border-top: 1px solid rgba(226, 232, 240, 0.9);
		display: flex;
		justify-content: flex-end;
	}

	.modal-ok-btn {
		padding: 8px 24px;
		border: none;
		border-radius: 999px;
		background: linear-gradient(135deg, #a2bffe, #7ba0f0);
		color: #fff;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}

	.chart-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.chart-header h3 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.carousel-dots {
		display: flex;
		gap: 6px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: none;
		background: var(--muted, #6b7a8c);
		opacity: 0.35;
		cursor: pointer;
		padding: 0;
		transition: opacity 0.2s;
	}

	.dot.active {
		opacity: 1;
		background: var(--primary-strong, #6b95e8);
	}

	.chart-fill {
		flex: 1;
		min-height: 0;
		width: 100%;
	}

	.drug-selector {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.loading-indicator {
		font-size: 0.8rem;
		color: var(--muted, #6b7a8c);
	}
</style>
