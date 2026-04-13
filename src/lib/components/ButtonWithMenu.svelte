<script lang="ts">
	import { onMount } from 'svelte';

	export let label: string;
	export let isActive = false;
	export let ariaCurrent: 'page' | undefined = undefined;
	export let menuItems: Array<{
		label: string;
		danger?: boolean;
		disabled?: boolean;
		onclick: () => void;
	}> = [];
	export let onclick: (() => void) | undefined = undefined;

	let menuOpen = false;
	let wrapperRef: HTMLDivElement | null = null;

	const toggleMenu = () => {
		menuOpen = !menuOpen;
	};

	const handleMenuItemClick = (item: (typeof menuItems)[number]) => {
		menuOpen = false;
		item.onclick();
	};

	const handleDocumentClick = (event: MouseEvent) => {
		if (!menuOpen) return;
		if (wrapperRef?.contains(event.target as Node)) return;
		menuOpen = false;
	};

	onMount(() => {
		document.addEventListener('click', handleDocumentClick);
		return () => document.removeEventListener('click', handleDocumentClick);
	});
</script>

<div class="btn-with-menu" bind:this={wrapperRef}>
	<button
		type="button"
		class="btn-with-menu-button"
		class:is-active={isActive}
		aria-current={ariaCurrent}
		on:click={onclick}
	>
		<span class="btn-with-menu-label">{label}</span>
		{#if menuItems.length > 0}
			<span
				class="btn-with-menu-trigger"
				role="button"
				tabindex="-1"
				on:click|stopPropagation={toggleMenu}
				aria-label="메뉴"
				aria-expanded={menuOpen}
			>
				<span class="material-symbols-outlined">more_vert</span>
			</span>
		{/if}
	</button>
	{#if menuOpen}
		<div class="btn-with-menu-dropdown">
			{#each menuItems as item}
				<button
					type="button"
					class="btn-with-menu-item"
					class:danger={item.danger}
					disabled={item.disabled}
					on:click|stopPropagation={() => handleMenuItemClick(item)}
				>
					{item.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.btn-with-menu {
		position: relative;
		display: flex;
		align-items: stretch;
	}

	.btn-with-menu-button {
		display: flex;
		align-items: center;
		flex: 1 1 auto;
		padding: 10px 12px;
		border: 1px solid rgba(255, 255, 255, 0.48);
		border-radius: 12px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.34), rgba(240, 248, 255, 0.16));
		box-shadow:
			0 10px 22px rgba(31, 74, 121, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.74);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-align: left;
		color: rgba(31, 43, 58, 0.68);
		cursor: pointer;
		transition:
			border-color 0.18s ease,
			background 0.18s ease,
			color 0.18s ease,
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}

	.btn-with-menu-button:hover {
		border-color: rgba(255, 255, 255, 0.72);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.44), rgba(240, 248, 255, 0.24));
		color: rgba(31, 43, 58, 0.82);
		transform: translateY(-1px);
	}

	.btn-with-menu-button.is-active {
		border-color: rgba(255, 255, 255, 0.82);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.54), rgba(226, 241, 255, 0.26));
		box-shadow:
			0 14px 28px rgba(31, 74, 121, 0.14),
			inset 0 1px 0 rgba(255, 255, 255, 0.84);
		color: rgba(31, 43, 58, 0.9);
		cursor: default;
		transform: none;
	}

	.btn-with-menu-label {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1 1 auto;
		min-width: 0;
	}

	.btn-with-menu-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		margin-left: auto;
		border-radius: 6px;
		color: var(--muted);
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.18s ease, background 0.18s ease, color 0.18s ease;
	}

	.btn-with-menu-button:hover .btn-with-menu-trigger,
	.btn-with-menu-trigger[aria-expanded='true'] {
		opacity: 1;
	}

	.btn-with-menu-trigger:hover {
		background: rgba(255, 255, 255, 0.62);
		color: var(--ink);
	}

	.btn-with-menu-trigger .material-symbols-outlined {
		font-size: 16px;
	}

	.btn-with-menu-dropdown {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 20;
		min-width: 118px;
		padding: 6px;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.94);
		border: 1px solid rgba(255, 255, 255, 0.82);
		box-shadow: 0 16px 30px rgba(31, 43, 58, 0.14);
	}

	.btn-with-menu-item {
		width: 100%;
		padding: 8px 10px;
		border: none;
		border-radius: 10px;
		background: transparent;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}

	.btn-with-menu-item:hover {
		background: rgba(148, 163, 184, 0.12);
	}

	.btn-with-menu-item.danger {
		color: #b64747;
	}

	.btn-with-menu-item:disabled {
		opacity: 0.65;
		cursor: wait;
	}
</style>
