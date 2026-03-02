<script lang="ts" module>
	export type DrugOption = {
		id: string;
		name: string;
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	type Props = {
		options?: DrugOption[];
		value?: string | null;
		placeholder?: string;
	};

	let { options = [], value = $bindable(null), placeholder = '약품 선택' }: Props =
		$props();

	let open = $state(false);
	let rootRef = $state<HTMLDivElement | null>(null);
	let query = $state('');
	let highlightedIndex = $state(0);

	const selected = () => options.find((option) => option.id === value);

	const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, '');

	const getSubsequenceScore = (source: string, term: string) => {
		let cursor = 0;
		let gapPenalty = 0;

		for (const character of term) {
			const nextIndex = source.indexOf(character, cursor);
			if (nextIndex === -1) return -1;
			gapPenalty += nextIndex - cursor;
			cursor = nextIndex + 1;
		}

		return 45 + term.length * 3 - gapPenalty;
	};

	const getFieldScore = (field: string, term: string) => {
		if (!term) return 0;
		if (field === term) return 120;
		if (field.startsWith(term)) return 95;

		const includesAt = field.indexOf(term);
		if (includesAt !== -1) return 78 - includesAt;

		return getSubsequenceScore(field, term);
	};

	const getOptionScore = (option: DrugOption, term: string) => {
		const normalizedName = normalize(option.name);
		const normalizedId = normalize(option.id);
		const nameScore = getFieldScore(normalizedName, term);
		const idScore = getFieldScore(normalizedId, term) + 2;
		return Math.max(nameScore, idScore);
	};

	const getDisplayValue = () => selected()?.name ?? '';

	const filteredOptions = $derived.by(() => {
		const normalizedQuery = normalize(query);

		if (!normalizedQuery) {
			return options.slice(0, 40);
		}

		return options
			.map((option) => ({ option, score: getOptionScore(option, normalizedQuery) }))
			.filter((entry) => entry.score >= 0)
			.sort((left, right) => right.score - left.score || left.option.name.localeCompare(right.option.name))
			.slice(0, 40)
			.map((entry) => entry.option);
	});

	const selectOption = (option: DrugOption) => {
		value = option.id;
		query = option.name;
		highlightedIndex = 0;
		open = false;
	};

	const handleFocus = () => {
		open = true;
		highlightedIndex = 0;
	};

	const handleInput = (event: Event) => {
		query = (event.currentTarget as HTMLInputElement).value;
		open = true;
		highlightedIndex = 0;
	};

	const handleClickOutside = (event: MouseEvent) => {
		if (!open) return;
		const target = event.target as Node;
		if (rootRef?.contains(target)) return;
		query = getDisplayValue();
		open = false;
	};

	const handleInputKeydown = (event: KeyboardEvent) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			open = true;
			highlightedIndex = Math.min(highlightedIndex + 1, Math.max(filteredOptions.length - 1, 0));
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
			return;
		}

		if (event.key === 'Enter' && open && filteredOptions[highlightedIndex]) {
			event.preventDefault();
			selectOption(filteredOptions[highlightedIndex]);
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			query = getDisplayValue();
			open = false;
		}
	};

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		query = getDisplayValue();
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	$effect(() => {
		if (!open) {
			query = getDisplayValue();
		}
	});
</script>

<div class="drug-select" bind:this={rootRef}>
	<div class="drug-input-wrap">
		<input
			type="text"
			class="drug-input"
			placeholder={placeholder}
			value={query}
			onfocus={handleFocus}
			oninput={handleInput}
			onkeydown={handleInputKeydown}
		/>
		<span class:open={open} class="drug-caret">▾</span>
	</div>

	{#if open}
		<div class="drug-menu" role="listbox" aria-label="약품 추천">
			{#if filteredOptions.length > 0}
				{#each filteredOptions as option, index}
					<button
						type="button"
						class:selected={option.id === value}
						class:highlighted={index === highlightedIndex}
						class="drug-option"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => selectOption(option)}
					>
						<span class="drug-option-name">{option.name}</span>
						<span class="drug-option-id">{option.id}</span>
					</button>
				{/each}
			{:else}
				<div class="drug-empty">검색 결과가 없습니다.</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.drug-select {
		position: relative;
		width: 100%;
	}

	.drug-input-wrap {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		border: 1px solid rgba(255, 255, 255, 0.85);
		background: rgba(255, 255, 255, 0.9);
		border-radius: 14px;
		padding: 4px 6px 4px 12px;
		box-shadow: 6px 6px 14px rgba(163, 181, 198, 0.18);
		font-family: inherit;
	}

	.drug-input {
		background: transparent;
		border: none;
		outline: none;
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--ink);
		line-height: 1.4;
		padding: 6px 0;
		flex: 1;
		min-width: 0;
	}

	.drug-input::placeholder {
		color: var(--muted);
		font-weight: 500;
	}

	.drug-caret {
		font-size: 0.8rem;
		color: var(--muted);
		transition: transform 0.2s ease;
		padding: 6px;
	}

	.drug-caret.open {
		transform: rotate(180deg);
	}

	.drug-menu {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		right: 0;
		max-height: 220px;
		overflow: auto;
		padding: 8px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.98);
		border: 1px solid rgba(255, 255, 255, 0.85);
		box-shadow: var(--shadow-glass);
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.drug-option {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		width: 100%;
		border: none;
		padding: 10px 12px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		font-family: inherit;
	}

	.drug-option.selected {
		background: rgba(87, 183, 196, 0.2);
	}

	.drug-option.highlighted {
		outline: 1px solid rgba(87, 183, 196, 0.45);
		background: rgba(87, 183, 196, 0.1);
	}

	.drug-option-name {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--ink);
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
	}

	.drug-option-id {
		font-size: 0.7rem;
		color: var(--muted);
		flex: 0 0 auto;
	}

	.drug-empty {
		padding: 12px;
		font-size: 0.78rem;
		color: var(--muted);
		text-align: center;
	}
</style>
