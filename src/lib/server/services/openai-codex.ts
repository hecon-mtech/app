import { ServiceError } from './errors';
import {
	OPENAI_CODEX_RESPONSES_URL,
	OPENAI_PLATFORM_RESPONSES_URL
} from '$lib/openai/constants';
import { DEFAULT_OPENAI_MODEL_ID, getOpenAiModelPreset } from '$lib/openai/models';
import { getUsableOpenAiCredential } from './openai-credentials';
import { OPENAI_READONLY_TOOLS, executeOpenAiTool, type OpenAiToolCall } from './openai-tools';

type PersistedTranscriptMessage = {
	role: 'user' | 'assistant';
	content: string;
	payload: unknown;
};

type ResponsesOutputItem = Record<string, unknown> & {
	type?: string;
	call_id?: string;
	name?: string;
	arguments?: string;
	role?: string;
	content?: Array<Record<string, unknown>>;
	text?: string;
	output_text?: string;
	encrypted_content?: string;
	status?: string;
	id?: string;
};

type ResponsesApiResult = {
	content: string;
	payload: Record<string, unknown>;
};

type ParsedSseResponse = {
	response: Record<string, unknown> | null;
	streamedText: string;
};

const ASSISTANT_INSTRUCTIONS = [
	'You are MTECHnician, the operations copilot for a hospital inventory dashboard.',
	'Answer in Korean unless the user clearly asks for another language.',
	'Use the provided tools whenever current app data is needed.',
	'Be direct, operational, and action-oriented.',
	'If data is missing or the user needs a write action that is not available, say so clearly.'
].join(' ');

const sanitizeInputItem = (item: Record<string, unknown>) => {
	const { id: _ignored, ...rest } = item;
	return rest;
};

const buildInputFromTranscript = (transcript: PersistedTranscriptMessage[]) => {
	const input: Array<Record<string, unknown>> = [];

	for (const message of transcript) {
		if (
			message.role === 'assistant' &&
			message.payload &&
			typeof message.payload === 'object' &&
			Array.isArray((message.payload as { providerItems?: unknown }).providerItems)
		) {
			for (const item of (message.payload as { providerItems: Array<Record<string, unknown>> }).providerItems) {
				input.push(sanitizeInputItem(item));
			}
			continue;
		}

		input.push({ role: message.role, content: message.content });
	}

	return input;
};

const createOAuthHeaders = (accessToken: string, accountId: string, promptCacheKey: string) => {
	const headers = new Headers();
	headers.set('Content-Type', 'application/json');
	headers.set('Authorization', `Bearer ${accessToken}`);
	headers.set('OpenAI-Beta', 'responses=experimental');
	headers.set('originator', 'codex_cli_rs');
	headers.set('chatgpt-account-id', accountId);
	headers.set('conversation_id', promptCacheKey);
	headers.set('session_id', promptCacheKey);
	headers.set('accept', 'text/event-stream');
	return headers;
};

const createApiKeyHeaders = (apiKey: string) => {
	const headers = new Headers();
	headers.set('Content-Type', 'application/json');
	headers.set('Authorization', `Bearer ${apiKey}`);
	return headers;
};

const collectTextFromContentItem = (contentItem: Record<string, unknown>) => {
	const directText = typeof contentItem.text === 'string' ? contentItem.text.trim() : '';
	if (directText) {
		return directText;
	}

	const nestedText = contentItem.text;
	if (nestedText && typeof nestedText === 'object' && typeof (nestedText as { value?: unknown }).value === 'string') {
		return (nestedText as { value: string }).value.trim();
	}

	if (typeof contentItem.output_text === 'string' && contentItem.output_text.trim()) {
		return contentItem.output_text.trim();
	}

	return '';
};

const parseSseResponse = async (response: Response): Promise<ParsedSseResponse> => {
	if (!response.body) {
		throw new ServiceError(502, 'OpenAI 응답 본문이 비어 있습니다.');
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let fullText = '';
	const streamedChunks: string[] = [];
	const completedAssistantTexts: string[] = [];
	const completedAssistantTextSet = new Set<string>();
	let finalResponse: Record<string, unknown> | null = null;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		fullText += decoder.decode(value, { stream: true });
	}

	for (const line of fullText.split('\n')) {
		if (!line.startsWith('data: ')) continue;

		try {
			const data = JSON.parse(line.slice(6)) as {
				type?: string;
				response?: Record<string, unknown>;
				delta?: string;
				text?: string;
				item?: ResponsesOutputItem;
				part?: Record<string, unknown>;
			};
			const eventType = typeof data.type === 'string' ? data.type : '';

			if (eventType.endsWith('.delta') && typeof data.delta === 'string' && data.delta) {
				streamedChunks.push(data.delta);
			}

			if (eventType.endsWith('.delta') && typeof data.text === 'string' && data.text) {
				streamedChunks.push(data.text);
			}

			if (eventType.endsWith('.delta') && data.part && typeof data.part === 'object') {
				const partText = collectTextFromContentItem(data.part);
				if (partText) {
					streamedChunks.push(partText);
				}
			}

			if (eventType.endsWith('.done') && data.item && typeof data.item === 'object') {
				const completedChunks: string[] = [];

				if (typeof data.item.output_text === 'string' && data.item.output_text.trim()) {
					completedChunks.push(data.item.output_text.trim());
				}

				if (data.item.role === 'assistant' && Array.isArray(data.item.content)) {
					for (const contentItem of data.item.content) {
						const chunk = collectTextFromContentItem(contentItem);
						if (chunk) {
							completedChunks.push(chunk);
						}
					}
				}

				const completedText = completedChunks.join('').trim();
				if (completedText && !completedAssistantTextSet.has(completedText)) {
					completedAssistantTextSet.add(completedText);
					completedAssistantTexts.push(completedText);
				}
			}

			if (data.type === 'response.done' || data.type === 'response.completed') {
				finalResponse = data.response ?? null;
			}
		} catch {
			// ignore malformed SSE chunks
		}
	}

	if (!finalResponse && streamedChunks.length === 0) {
		throw new ServiceError(502, 'OpenAI SSE 응답에서 최종 결과를 찾지 못했습니다.');
	}

	return {
		response: finalResponse,
		streamedText: streamedChunks.join('').trim() || completedAssistantTexts.join('\n\n').trim()
	};
};

const parseToolCalls = (outputItems: ResponsesOutputItem[]): OpenAiToolCall[] =>
	outputItems
		.filter((item) => item.type === 'function_call')
		.map((item) => ({
			name: typeof item.name === 'string' ? item.name : '',
			argumentsJson: typeof item.arguments === 'string' ? item.arguments : '{}',
			callId: typeof item.call_id === 'string' ? item.call_id : ''
		}))
		.filter((item) => item.name && item.callId);

const parseAssistantText = (
	response: Record<string, unknown> | null,
	outputItems: ResponsesOutputItem[],
	streamedText: string
) => {
	if (response && typeof response.output_text === 'string' && response.output_text.trim()) {
		return response.output_text.trim();
	}

	const chunks: string[] = [];

	for (const item of outputItems) {
		if (typeof item.output_text === 'string' && item.output_text.trim()) {
			chunks.push(item.output_text.trim());
		}

		if (typeof item.text === 'string' && item.text.trim()) {
			chunks.push(item.text.trim());
		}

		if (item.type !== 'message' || item.role !== 'assistant' || !Array.isArray(item.content)) {
			continue;
		}

		for (const contentItem of item.content) {
			const chunk = collectTextFromContentItem(contentItem);
			if (chunk) {
				chunks.push(chunk);
			}
		}
	}

	const parsed = chunks.join('\n\n').trim();
	if (parsed) {
		return parsed;
	}

	return streamedText.trim();
};

const parseOpenAiError = async (response: Response) => {
	const text = await response.text().catch(() => '');
	const haystack = text.toLowerCase();

	if (response.status === 401) {
		throw new ServiceError(401, 'OpenAI 인증이 만료되었거나 유효하지 않습니다. 다시 연결해주세요.');
	}

	if (
		response.status === 404 ||
		response.status === 429 ||
		/usage_limit_reached|usage_not_included|rate_limit_exceeded|usage limit/.test(haystack)
	) {
		throw new ServiceError(429, 'ChatGPT Plus/Pro 사용 한도에 도달했습니다. 잠시 후 다시 시도해주세요.');
	}

	throw new ServiceError(response.status || 502, text || 'OpenAI 요청에 실패했습니다.');
};

const runResponsesRequest = async (
	credential: Awaited<ReturnType<typeof getUsableOpenAiCredential>>,
	modelId: string,
	promptCacheKey: string,
	input: Array<Record<string, unknown>>
) => {
	const preset = getOpenAiModelPreset(modelId) ?? getOpenAiModelPreset(DEFAULT_OPENAI_MODEL_ID);
	if (!preset) {
		throw new ServiceError(400, '지원되지 않는 모델입니다.');
	}

	const body = {
		model: preset.id,
		store: false,
		stream: true,
		instructions: ASSISTANT_INSTRUCTIONS,
		input,
		include: preset.include,
		reasoning: {
			effort: preset.reasoningEffort,
			summary: preset.reasoningSummary
		},
		text: {
			verbosity: preset.textVerbosity
		},
		prompt_cache_key: promptCacheKey,
		tools: preset.supportsTools ? OPENAI_READONLY_TOOLS : []
	};

	const usingOauth = credential.oauth !== null;
	const endpoint = usingOauth ? OPENAI_CODEX_RESPONSES_URL : OPENAI_PLATFORM_RESPONSES_URL;
	const headers = usingOauth
		? createOAuthHeaders(credential.oauth!.access, credential.oauth!.accountId ?? '', promptCacheKey)
		: createApiKeyHeaders(credential.apiKey ?? '');

	if (usingOauth && !credential.oauth?.accountId) {
		throw new ServiceError(400, 'OpenAI OAuth 계정 정보가 부족합니다. 다시 연결해주세요.');
	}

	if (!usingOauth && !credential.apiKey) {
		throw new ServiceError(400, '선택한 OpenAI 자격증명에 사용할 인증 정보가 없습니다.');
	}

	const response = await fetch(endpoint, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		await parseOpenAiError(response);
	}

	return parseSseResponse(response);
};

export const generateAssistantReply = async ({
	userId,
	hospitalId,
	credentialId,
	modelId,
	promptCacheKey,
	transcript
}: {
	userId: string;
	hospitalId: string;
	credentialId: number;
	modelId: string;
	promptCacheKey: string;
	transcript: PersistedTranscriptMessage[];
}): Promise<ResponsesApiResult> => {
	const credential = await getUsableOpenAiCredential(userId, credentialId);
	const workingInput = buildInputFromTranscript(transcript);
	const toolTrace: Array<Record<string, unknown>> = [];

	for (let depth = 0; depth < 6; depth += 1) {
		const { response, streamedText } = await runResponsesRequest(credential, modelId, promptCacheKey, workingInput);
		if (!response && !streamedText) {
			throw new ServiceError(502, 'OpenAI 응답에서 최종 결과를 찾지 못했습니다.');
		}
		const outputItems = Array.isArray(response?.output)
			? (response.output as ResponsesOutputItem[]).map(sanitizeInputItem)
			: [];
		const toolCalls = parseToolCalls(outputItems);

		if (toolCalls.length === 0) {
			const content = parseAssistantText(response, outputItems, streamedText);
			if (!content) {
				throw new ServiceError(502, 'OpenAI 응답에서 assistant 메시지를 찾지 못했습니다.');
			}

			return {
				content,
				payload: {
					provider: credential.oauth ? 'openai-oauth' : 'openai-api-key',
					modelId,
					providerItems: outputItems,
					toolTrace
				}
			};
		}

		for (const toolCall of toolCalls) {
			const result = await executeOpenAiTool(hospitalId, toolCall);
			toolTrace.push({
				name: toolCall.name,
				arguments: toolCall.argumentsJson,
				result
			});

			workingInput.push({
				type: 'function_call',
				call_id: toolCall.callId,
				name: toolCall.name,
				arguments: toolCall.argumentsJson
			});
			workingInput.push({
				type: 'function_call_output',
				call_id: toolCall.callId,
				output: JSON.stringify(result)
			});
		}
	}

	throw new ServiceError(502, 'OpenAI 도구 호출 루프가 너무 길어 중단되었습니다.');
};
