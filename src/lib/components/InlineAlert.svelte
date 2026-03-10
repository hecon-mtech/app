<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let title = '';
	export let message = '';
	export let tone: 'success' | 'error' | 'info' = 'info';
	export let actionLabel = '';
	export let busy = false;

	const dispatch = createEventDispatcher<{ action: void }>();

	const onAction = () => {
		if (busy) return;
		dispatch('action');
	};
</script>

<article class={`inline-alert ${tone}`} role="status" aria-live="polite">
	{#if title}
		<h4>{title}</h4>
	{/if}
	<p>{message}</p>
	{#if actionLabel}
		<div class="inline-alert-action">
			<button type="button" class="button" on:click={onAction} disabled={busy}>
				{busy ? '처리 중...' : actionLabel}
			</button>
		</div>
	{/if}
</article>

<style>
	.inline-alert {
		display: grid;
		gap: 10px;
		padding: 16px 18px;
		border-radius: 16px;
		border: 1px solid transparent;
	}

	.inline-alert h4,
	.inline-alert p {
		margin: 0;
	}

	.inline-alert.success {
		background: rgba(27, 127, 60, 0.1);
		border-color: rgba(27, 127, 60, 0.25);
		color: #165f2f;
	}

	.inline-alert.error {
		background: rgba(192, 57, 43, 0.1);
		border-color: rgba(192, 57, 43, 0.25);
		color: #8f2c21;
	}

	.inline-alert.info {
		background: rgba(52, 101, 212, 0.1);
		border-color: rgba(52, 101, 212, 0.24);
		color: #244d9f;
	}

	.inline-alert-action {
		display: flex;
		justify-content: center;
		padding-top: 6px;
	}
</style>
