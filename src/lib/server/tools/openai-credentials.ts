import {
	createOpenAiCredential as createOpenAiCredentialService,
	getOpenAiCredentialsState as getOpenAiCredentialsStateService
} from '../services/openai-credentials';
import type { HospitalToolContext } from './types';

export const getOpenAiCredentialsState = ({ hospitalId }: HospitalToolContext) =>
	getOpenAiCredentialsStateService(hospitalId);

export const createOpenAiCredential = ({ hospitalId }: HospitalToolContext, payload: unknown) =>
	createOpenAiCredentialService(hospitalId, payload);
