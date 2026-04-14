<script lang="ts">
	import type { ChatRenderBlock } from '$lib/chat/render-blocks';
	import EChartsBlock from './EChartsBlock.svelte';

	export let blocks: ChatRenderBlock[] = [];

	const formatCellValue = (value: unknown) => {
		if (value === null || value === undefined || value === '') return '-';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		return String(value);
	};
</script>

{#if blocks.length > 0}
	<div class="render-blocks">
		{#each blocks as block (block.id)}
			<section class={`render-block render-block-${block.type}`}>
				{#if block.title}
					<h4>{block.title}</h4>
				{/if}
				{#if block.type === 'html'}
					<div class="render-html">{@html block.html}</div>
				{:else if block.type === 'echarts'}
					<EChartsBlock option={block.option} />
				{:else}
					<div class="render-table-wrap">
						<table class="render-table">
							<thead>
								<tr>
									{#each block.columns as column}
										<th>{column}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each block.rows as row}
									<tr>
										{#each block.columns as column}
											<td>{formatCellValue(row[column])}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>
		{/each}
	</div>
{/if}

<style>
	.render-blocks {
		display: grid;
		gap: 12px;
	}

	.render-block {
		display: grid;
		gap: 10px;
		padding: 12px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.52);
		border: 1px solid rgba(255, 255, 255, 0.72);
	}

	.render-block h4 {
		margin: 0;
		font-size: 0.84rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgba(31, 43, 58, 0.56);
	}

	.render-html :global(.tool-graph-card) {
		display: grid;
		gap: 12px;
	}

	.render-html :global(.tool-graph-header),
	.render-html :global(.tool-graph-legend),
	.render-html :global(.tool-graph-axis) {
		display: flex;
		gap: 12px;
	}

	.render-html :global(.tool-graph-header) {
		align-items: flex-start;
		justify-content: space-between;
		flex-wrap: wrap;
	}

	.render-html :global(.tool-graph-kicker),
	.render-html :global(.tool-graph-header h4) {
		margin: 0;
	}

	.render-html :global(.tool-graph-kicker) {
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(31, 43, 58, 0.52);
	}

	.render-html :global(.tool-graph-header h4) {
		font-size: 1rem;
		color: var(--ink);
	}

	.render-html :global(.tool-graph-legend) {
		flex-wrap: wrap;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.render-html :global(.tool-graph-legend span) {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.render-html :global(.tool-graph-legend i) {
		display: inline-block;
		width: 14px;
		height: 3px;
		border-radius: 999px;
	}

	.render-html :global(.tool-graph-legend .actual),
	.render-html :global(.actual-line) {
		background: #1e63b5;
		stroke: #1e63b5;
	}

	.render-html :global(.tool-graph-legend .prediction),
	.render-html :global(.prediction-line) {
		background: #e68a2e;
		stroke: #e68a2e;
	}

	.render-html :global(.tool-graph-legend .upper),
	.render-html :global(.upper-line) {
		background: #cf4d66;
		stroke: #cf4d66;
	}

	.render-html :global(.tool-graph-legend .lower),
	.render-html :global(.lower-line) {
		background: #679d50;
		stroke: #679d50;
	}

	.render-html :global(.tool-graph-svg) {
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.render-html :global(.tool-graph-svg path) {
		fill: none;
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.render-html :global(.tool-graph-axis) {
		justify-content: space-between;
		font-size: 0.74rem;
		color: rgba(31, 43, 58, 0.52);
	}

	.render-table-wrap {
		overflow-x: auto;
	}

	.render-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
	}

	.render-table th,
	.render-table td {
		padding: 8px 10px;
		border-bottom: 1px solid rgba(31, 43, 58, 0.1);
		text-align: left;
		vertical-align: top;
	}

	.render-table th {
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgba(31, 43, 58, 0.5);
	}

	.render-html :global(.auction-card) {
		display: grid;
		gap: 8px;
		padding: 14px 16px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.7);
		border: 1px solid rgba(31, 43, 58, 0.1);
	}

	.render-html :global(.auction-card--expired) {
		opacity: 0.55;
	}

	.render-html :global(.auction-card__header) {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.render-html :global(.auction-card__name) {
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--ink, #1f2b3a);
	}

	.render-html :global(.auction-card__id) {
		font-size: 0.72rem;
		color: rgba(31, 43, 58, 0.45);
	}

	.render-html :global(.auction-card__body) {
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
	}

	.render-html :global(.auction-card__stat) {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.render-html :global(.auction-card__label) {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgba(31, 43, 58, 0.45);
	}

	.render-html :global(.auction-card__value) {
		font-size: 0.88rem;
		color: var(--ink, #1f2b3a);
	}

	.render-html :global(.auction-card__expired-text) {
		color: #cf4d66;
		font-weight: 600;
	}

	.render-html :global(.auction-reg-list) {
		margin: 0;
		padding-left: 18px;
		font-size: 0.88rem;
		line-height: 1.6;
	}
</style>
