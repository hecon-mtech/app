<script lang="ts">
	import { createEventDispatcher } from 'svelte';

export let open = false;
export let title = '';
export let maxWidth = '680px';

	const dispatch = createEventDispatcher<{ close: void }>();

	const close = () => {
		dispatch('close');
	};
</script>

{#if open}
	<div class="modal-backdrop" role="presentation" on:click={close}></div>
	<div
		class="modal"
		style={`--modal-max-width: ${maxWidth};`}
		role="dialog"
		aria-modal="true"
		aria-label={title}
	>
		<header class="modal-header">
			<h3>{title}</h3>
			<button type="button" class="modal-close" aria-label="닫기" on:click={close}>x</button>
		</header>
		<div class="modal-content">
			<slot />
		</div>
		<footer class="modal-footer">
			<slot name="footer" />
		</footer>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.45);
		z-index: 9000;
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(var(--modal-max-width, 680px), calc(100vw - 32px));
		max-height: 80vh;
		overflow: hidden;
		z-index: 9001;
		background: #fff;
		border-radius: 18px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		display: grid;
		grid-template-rows: auto 1fr auto;
	}

	.modal-header,
	.modal-footer {
		padding: 14px 16px;
		border-bottom: 1px solid rgba(226, 232, 240, 0.9);
	}

	.modal-footer {
		border-bottom: none;
		border-top: 1px solid rgba(226, 232, 240, 0.9);
		display: flex;
		justify-content: flex-end;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.modal-header h3 {
		margin: 0;
	}

	.modal-close {
		border: 0;
		background: transparent;
		cursor: pointer;
		font-size: 1rem;
		color: var(--muted);
	}

	.modal-content {
		padding: 16px;
		overflow: auto;
	}
</style>
