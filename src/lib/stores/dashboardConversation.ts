import { writable } from 'svelte/store';
import type { AssistantPayload } from '$lib/chat/render-blocks';

export type DashboardConversationEntry = {
	id: number;
	role: 'assistant' | 'user';
	content: string;
	createdAt: string;
	payload?: AssistantPayload | null;
};

export type DashboardConversationSession = {
	id: number;
	title: string;
	createdAt: string;
	updatedAt: string;
	credentialId: number;
	credentialName: string;
	modelId: string;
	modelLabel: string;
};

export type DashboardConversationState = {
	sessions: DashboardConversationSession[];
	activeSessionId: number | null;
	entries: DashboardConversationEntry[];
	loadingSessions: boolean;
	loadingEntries: boolean;
};

const initialState: DashboardConversationState = {
	sessions: [],
	activeSessionId: null,
	entries: [],
	loadingSessions: false,
	loadingEntries: false
};

const sortSessions = (sessions: DashboardConversationSession[]) =>
	[...sessions].sort((left, right) => {
		const updatedAtDiff = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
		return updatedAtDiff !== 0 ? updatedAtDiff : right.id - left.id;
	});

const dashboardConversation = writable<DashboardConversationState>(initialState);

const patchDashboardConversation = (
	updater: (state: DashboardConversationState) => DashboardConversationState
) => {
	dashboardConversation.update(updater);
};

const setDashboardConversationSessions = (sessions: DashboardConversationSession[]) => {
	patchDashboardConversation((state) => ({
		...state,
		sessions: sortSessions(sessions)
	}));
};

const upsertDashboardConversationSession = (session: DashboardConversationSession) => {
	patchDashboardConversation((state) => ({
		...state,
		sessions: sortSessions([
			session,
			...state.sessions.filter((item) => item.id !== session.id)
		])
	}));
};

const removeDashboardConversationSession = (sessionId: number) => {
	patchDashboardConversation((state) => {
		const remainingSessions = sortSessions(state.sessions.filter((item) => item.id !== sessionId));
		const nextActiveSessionId =
			state.activeSessionId === sessionId ? remainingSessions[0]?.id ?? null : state.activeSessionId;

		return {
			...state,
			sessions: remainingSessions,
			activeSessionId: nextActiveSessionId,
			entries: nextActiveSessionId === state.activeSessionId ? state.entries : []
		};
	});
};

const selectDashboardConversationSession = (sessionId: number | null) => {
	patchDashboardConversation((state) => ({
		...state,
		activeSessionId: sessionId,
		entries: sessionId !== null && sessionId === state.activeSessionId ? state.entries : []
	}));
};

const setDashboardConversationEntries = (entries: DashboardConversationEntry[]) => {
	patchDashboardConversation((state) => ({
		...state,
		entries
	}));
};

const setDashboardConversationLoading = (
	target: 'sessions' | 'entries',
	value: boolean
) => {
	patchDashboardConversation((state) => ({
		...state,
		loadingSessions: target === 'sessions' ? value : state.loadingSessions,
		loadingEntries: target === 'entries' ? value : state.loadingEntries
	}));
};

const resetDashboardConversation = () => {
	dashboardConversation.set(initialState);
};

export {
	dashboardConversation,
	removeDashboardConversationSession,
	resetDashboardConversation,
	selectDashboardConversationSession,
	setDashboardConversationEntries,
	setDashboardConversationLoading,
	setDashboardConversationSessions,
	upsertDashboardConversationSession
};
