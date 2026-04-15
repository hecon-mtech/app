import { writable } from 'svelte/store';

/** Canonical "today" shared across client components. Initialized from layout server data. */
export const today = writable<Date>(new Date());

export const initToday = (value: string) => {
	today.set(new Date(value));
};
