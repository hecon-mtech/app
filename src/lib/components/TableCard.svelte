<script lang="ts">
	import Card from '$lib/components/Card.svelte';

	export let title: string = '';
	export let subtitle: string = '';
	export let columns: Array<{
		id: string;
		label: string;
		type?: 'text' | 'status' | 'action';
	}> = [];
	export let rows: Array<Record<string, string | number>> = [];
</script>

<Card {title} {subtitle}>
	{#if columns.length}
		<div class="table-scroll">
		<table class="table">
			<thead>
				<tr>
					{#each columns as column}
						<th>{column.label}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row}
					<tr>
						{#each columns as column}
							<td>
								{#if column.type === 'status'}
									<span class={`status ${row.status}`}>{row[column.id]}</span>
								{:else if column.type === 'action'}
									<button type="button" class="table-action-btn">{row[column.id]}</button>
								{:else}
									{row[column.id]}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
		</div>
	{:else}
		<slot />
	{/if}
</Card>
