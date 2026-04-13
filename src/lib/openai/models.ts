export type OpenAiModelPreset = {
	id: string;
	label: string;
	description: string;
	reasoningEffort: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
	reasoningSummary: 'auto' | 'concise' | 'detailed' | 'off' | 'on';
	textVerbosity: 'low' | 'medium' | 'high';
	include: string[];
	supportsTools: boolean;
};

export const OPENAI_MODEL_PRESETS: OpenAiModelPreset[] = [
	{
		id: 'gpt-5.3-codex',
		label: 'GPT 5.3 Codex',
		description: '최신 코딩/운영 질의용 Codex 모델',
		reasoningEffort: 'medium',
		reasoningSummary: 'auto',
		textVerbosity: 'medium',
		include: ['reasoning.encrypted_content'],
		supportsTools: true
	},
	{
		id: 'gpt-5.3',
		label: 'GPT 5.3',
		description: '최신 범용 reasoning 모델',
		reasoningEffort: 'medium',
		reasoningSummary: 'auto',
		textVerbosity: 'medium',
		include: ['reasoning.encrypted_content'],
		supportsTools: true
	},
	{
		id: 'gpt-5.2-codex',
		label: 'GPT 5.2 Codex',
		description: '코딩 및 도구 사용에 최적화된 기본 추천 모델',
		reasoningEffort: 'medium',
		reasoningSummary: 'auto',
		textVerbosity: 'medium',
		include: ['reasoning.encrypted_content'],
		supportsTools: true
	},
	{
		id: 'gpt-5.2',
		label: 'GPT 5.2',
		description: '범용 reasoning 응답에 적합한 모델',
		reasoningEffort: 'medium',
		reasoningSummary: 'auto',
		textVerbosity: 'medium',
		include: ['reasoning.encrypted_content'],
		supportsTools: true
	},
	{
		id: 'gpt-5.1-codex',
		label: 'GPT 5.1 Codex',
		description: '안정적인 코드/도구 사용 중심 모델',
		reasoningEffort: 'medium',
		reasoningSummary: 'auto',
		textVerbosity: 'medium',
		include: ['reasoning.encrypted_content'],
		supportsTools: true
	},
	{
		id: 'gpt-5.1-codex-max',
		label: 'GPT 5.1 Codex Max',
		description: '더 깊은 reasoning이 필요한 복잡한 운영 질의용',
		reasoningEffort: 'high',
		reasoningSummary: 'detailed',
		textVerbosity: 'medium',
		include: ['reasoning.encrypted_content'],
		supportsTools: true
	},
	{
		id: 'gpt-5.1',
		label: 'GPT 5.1',
		description: '비교적 보수적인 범용 reasoning 모델',
		reasoningEffort: 'medium',
		reasoningSummary: 'auto',
		textVerbosity: 'medium',
		include: ['reasoning.encrypted_content'],
		supportsTools: true
	}
];

export const DEFAULT_OPENAI_MODEL_ID = 'gpt-5.2-codex';

export const getOpenAiModelPreset = (modelId: string | null | undefined) =>
	OPENAI_MODEL_PRESETS.find((preset) => preset.id === modelId) ?? null;
