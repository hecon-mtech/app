<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as echarts from 'echarts';

	export let option: Record<string, unknown>;

	let container: HTMLDivElement;
	let chart: echarts.ECharts | undefined;
	let observer: ResizeObserver | undefined;

	onMount(() => {
		chart = echarts.init(container);
		chart.setOption(option);
		observer = new ResizeObserver(() => chart?.resize());
		observer.observe(container);
	});

	onDestroy(() => {
		observer?.disconnect();
		chart?.dispose();
	});
</script>

<div bind:this={container} class="echarts-container"></div>

<style>
	.echarts-container {
		width: 100%;
		height: 280px;
	}
</style>
