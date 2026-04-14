import { summarizeRecentPatients } from '$lib/server/tools';
import { ServiceError } from './errors';
import toolDefs from '../../../../tools.json';

export type OpenAiToolDefinition = {
	type: 'function';
	name: string;
	description: string;
	parameters: Record<string, unknown>;
};

export type OpenAiToolCall = {
	name: string;
	argumentsJson: string;
	callId: string;
};

type OpenAiToolExecutor = (hospitalId: string, args: Record<string, unknown>) => Promise<unknown> | unknown;

const EXECUTORS: Record<string, OpenAiToolExecutor> = {
	summarize_recent_patients: (hospitalId) => summarizeRecentPatients({ hospitalId })
};

const OPENAI_TOOL_REGISTRY = toolDefs.map((def) => ({
	definition: { type: 'function' as const, ...def } satisfies OpenAiToolDefinition,
	execute: EXECUTORS[def.name]
}));

const OPENAI_TOOL_REGISTRY_BY_NAME = new Map(
	OPENAI_TOOL_REGISTRY.map((entry) => [entry.definition.name, entry])
);

export const OPENAI_READONLY_TOOLS: OpenAiToolDefinition[] = OPENAI_TOOL_REGISTRY.map(
	(entry) => entry.definition
);

export const executeOpenAiTool = async (
	hospitalId: string,
	call: OpenAiToolCall
) => {
	let parsedArgs: Record<string, unknown>;

	try {
		parsedArgs = call.argumentsJson ? (JSON.parse(call.argumentsJson) as Record<string, unknown>) : {};
	} catch {
		throw new ServiceError(400, `${call.name} arguments are not valid JSON.`);
	}

	const entry = OPENAI_TOOL_REGISTRY_BY_NAME.get(call.name);
	if (!entry) {
		throw new ServiceError(400, `Unsupported tool: ${call.name}`);
	}

	return entry.execute(hospitalId, parsedArgs);
};
