import { summarizeRecentPatients, getCurrentDate, createAuctionOrder, getCurrentAuctionStatus } from '$lib/server/tools';
import { summarizeRecentInventoryTool, inventoryPredictionTool, suggestOrderTool } from '$lib/server/tools/inventory';
import { searchDrugsTool } from '$lib/server/tools/drugs';
import { ServiceError } from '$lib/server/services/errors';
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
	summarize_recent_patients: (hospitalId, args) =>
		summarizeRecentPatients(
			{ hospitalId },
			{ start_date: args.start_date as string, end_date: args.end_date as string }
		),
	summarize_recent_inventory: (hospitalId, args) =>
		summarizeRecentInventoryTool(
			{ hospitalId },
			{ start_date: args.start_date as string, end_date: args.end_date as string }
		),
	inventory_prediction: (hospitalId, args) =>
		inventoryPredictionTool(
			{ hospitalId },
			{ drug_code: args.drug_code as string, prediction_start_date: args.prediction_start_date as string }
		),
	suggest_order: (hospitalId, args) =>
		suggestOrderTool({ hospitalId }, { drug_id: args.drug_id as string | undefined }),
	search_drugs: (_hospitalId, args) => searchDrugsTool(String(args.query ?? '')),
	get_current_date: () => getCurrentDate(),
	register_auction: async (hospitalId, args) => {
		const orders = Array.isArray(args.orders) ? args.orders : [];
		const results = [];
		for (const order of orders) {
			const o = order as Record<string, unknown>;
			results.push(await createAuctionOrder({ hospitalId }, {
				drugId: String(o.drug_id ?? ''),
				quantity: Number(o.quantity ?? 0)
			}));
		}
		return { registered: results };
	},
	get_current_auction_status: (hospitalId) =>
		getCurrentAuctionStatus({ hospitalId })
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
