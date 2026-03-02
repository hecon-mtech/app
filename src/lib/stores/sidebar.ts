import { writable } from 'svelte/store';

const STORAGE_KEY = 'sidebar-collapsed';

function getInitialState(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored === 'true';
	} catch {
		return false;
	}
}

function createSidebarStore() {
	const { subscribe, set, update } = writable<boolean>(getInitialState());

	return {
		subscribe,
		toggle: () =>
			update((v) => {
				const next = !v;
				try {
					localStorage.setItem(STORAGE_KEY, String(next));
				} catch {
					/* ignore */
				}
				return next;
			}),
		set: (value: boolean) => {
			set(value);
			try {
				localStorage.setItem(STORAGE_KEY, String(value));
			} catch {
				/* ignore */
			}
		}
	};
}

export const sidebarCollapsed = createSidebarStore();

export function initSidebarStore() {
	if (typeof window !== 'undefined') {
		sidebarCollapsed.set(getInitialState());
	}
}
