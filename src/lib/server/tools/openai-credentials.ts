import {
	createOpenAiCredential as createOpenAiCredentialService,
	getOpenAiCredentialsState as getOpenAiCredentialsStateService
} from '$lib/openai/agent/credentials';
import type { HospitalToolContext } from './types';

export const getOpenAiCredentialsState = ({ hospitalId }: HospitalToolContext) =>
	getOpenAiCredentialsStateService(hospitalId);

export const createOpenAiCredential = ({ hospitalId }: HospitalToolContext, payload: unknown) =>
	createOpenAiCredentialService(hospitalId, payload);
