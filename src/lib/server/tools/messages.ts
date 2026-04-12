import {
	createChatSession as createChatSessionService,
	getChatMessages as getChatMessagesService,
	listChatSessions as listChatSessionsService,
	sendChatMessage as sendChatMessageService
} from '../services/messages';
import type { HospitalToolContext } from './types';

export const listChatSessions = ({ hospitalId }: HospitalToolContext) =>
	listChatSessionsService(hospitalId);

export const createChatSession = ({ hospitalId }: HospitalToolContext) =>
	createChatSessionService(hospitalId, {});

export const loadChatMessages = ({ hospitalId }: HospitalToolContext, sessionId: unknown) =>
	getChatMessagesService(hospitalId, sessionId);

export const sendChatMessage = ({ hospitalId }: HospitalToolContext, payload: unknown) =>
	sendChatMessageService(hospitalId, payload);
