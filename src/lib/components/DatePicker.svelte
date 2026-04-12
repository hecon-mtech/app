<script lang="ts">
	import { onMount } from 'svelte';
	import { selectedWeek, setSelectedWeek } from '$lib/stores/dateRange';

	export let inline = false;

	let open = false;
	let locale = 'ko-KR';
	let today = new Date();
	let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

	let panelRef: HTMLDivElement | null = null;
	let triggerRef: HTMLButtonElement | null = null;

	const weekLabels = ['일', '월', '화', '수', '목', '금', '토'];

	const getMonthLabel = (date: Date) =>
		new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);

	const formatRange = (start: Date, end: Date) => {
		const formatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
		return `${formatter.format(start)} ~ ${formatter.format(end)}`;
	};

	const getCalendarDays = (month: Date) => {
		const first = new Date(month.getFullYear(), month.getMonth(), 1);
		const startOffset = first.getDay();
		const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset);
		const days: Date[] = [];
		for (let i = 0; i < 42; i += 1) {
			days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
		}
		return days;
	};

	const isSameDay = (a: Date, b: Date) =>
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate();

	const isInSelectedWeek = (date: Date) =>
		date >= $selectedWeek.start && date <= $selectedWeek.end;

	const goPrevMonth = () => {
		currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
	};

	const goNextMonth = () => {
		currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
	};

	const selectDate = (date: Date) => {
		currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
		setSelectedWeek(date);
	};

	onMount(() => {
		locale = navigator.language || 'ko-KR';
		today = new Date();
		currentMonth = new Date($selectedWeek.start.getFullYear(), $selectedWeek.start.getMonth(), 1);

		if (inline) return;

		const handleClick = (event: MouseEvent) => {
			const target = event.target as Node;
			if (!open) return;
			if (panelRef?.contains(target) || triggerRef?.contains(target)) return;
			open = false;
		};

		document.addEventListener('click', handleClick);
		return () => document.removeEventListener('click', handleClick);
	});
</script>

<div class:inline class="date-picker">
	{#if !inline}
		<button class="date-trigger" bind:this={triggerRef} type="button" on:click={() => (open = !open)}>
			<div class="date-pill-label">Date</div>
			<div class="date-pill-value">
				{formatRange($selectedWeek.start, $selectedWeek.end)}
			</div>
		</button>
	{/if}

	{#if inline || open}
		<div class="date-panel" bind:this={panelRef}>
			{#if inline}
				<div class="date-inline-summary">
					<div class="date-pill-label">현재 주간</div>
					<div class="date-pill-value">{formatRange($selectedWeek.start, $selectedWeek.end)}</div>
				</div>
			{/if}

			<div class="date-panel-header">
				<button type="button" class="nav-btn" on:click={goPrevMonth}>‹</button>
				<div class="month-label">{getMonthLabel(currentMonth)}</div>
				<button type="button" class="nav-btn" on:click={goNextMonth}>›</button>
			</div>

			<div class="weekday-row">
				{#each weekLabels as label}
					<div>{label}</div>
				{/each}
			</div>

			<div class="date-grid">
				{#each getCalendarDays(currentMonth) as day}
					<button
						type="button"
						class:outside={day.getMonth() !== currentMonth.getMonth()}
						class:selected={isInSelectedWeek(day)}
						class:today={isSameDay(day, today)}
						on:click={() => selectDate(day)}
					>
						{day.getDate()}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.date-picker {
		position: relative;
	}

	.date-picker.inline {
		width: 100%;
	}

	.date-trigger {
		border: none;
		cursor: pointer;
		padding: 10px 18px;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.8);
		box-shadow: var(--shadow-soft);
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 170px;
		align-items: flex-start;
		font-family: inherit;
	}

	.date-pill-label {
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.date-pill-value {
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--ink);
	}

	.date-panel {
		position: absolute;
		top: calc(100% + 12px);
		right: 0;
		width: 260px;
		padding: 16px 16px 18px;
		border-radius: 24px;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow: var(--shadow-glass);
		z-index: 4000;
	}

	.date-picker.inline .date-panel {
		position: static;
		top: auto;
		right: auto;
		width: 100%;
		max-width: 100%;
		padding: 14px 14px 12px;
	}

	.date-inline-summary {
		display: grid;
		gap: 4px;
		margin-bottom: 10px;
	}

	.date-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.month-label {
		font-weight: 600;
		font-size: 0.95rem;
	}

	.nav-btn {
		border: none;
		background: rgba(255, 255, 255, 0.7);
		width: 32px;
		height: 32px;
		border-radius: 12px;
		cursor: pointer;
		box-shadow: var(--shadow-soft);
		color: var(--muted);
	}

	.weekday-row {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		text-align: center;
		font-size: 0.75rem;
		color: var(--muted);
		margin-bottom: 6px;
	}

	.date-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 6px;
	}

	.date-picker.inline .weekday-row {
		margin-bottom: 4px;
	}

	.date-picker.inline .date-grid {
		gap: 4px;
	}

	.date-grid button {
		border: none;
		background: transparent;
		border-radius: 12px;
		padding: 8px 0;
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		color: var(--ink);
	}

	.date-picker.inline .date-grid button {
		padding: 5px 0;
		font-size: 0.82rem;
	}

	.date-grid button.outside {
		color: rgba(107, 122, 140, 0.45);
	}

	.date-grid button.selected {
		background: rgba(87, 183, 196, 0.2);
		color: var(--primary-strong);
		font-weight: 600;
	}

	.date-grid button.today {
		box-shadow: inset 0 0 0 1px rgba(87, 183, 196, 0.35);
	}
</style>
