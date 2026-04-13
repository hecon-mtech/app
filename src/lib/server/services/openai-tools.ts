import {
	getUsageForecast,
	getCurrentAuctionStatus,
	listAlerts,
	listRecentOrders,
	listStockShortageOrders,
	listUsageForecastDrugOptions
} from '$lib/server/tools';
import { ServiceError } from './errors';

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

type OpenAiToolRegistryEntry = {
	definition: OpenAiToolDefinition;
	execute: OpenAiToolExecutor;
};

const requireString = (value: unknown, field: string) => {
	if (typeof value !== 'string' || !value.trim()) {
		throw new ServiceError(400, `${field} is required.`);
	}
	return value.trim();
};

const OPENAI_TOOL_REGISTRY: OpenAiToolRegistryEntry[] = [
	{
		definition: {
			type: 'function',
			name: 'list_alerts',
			description: '현재 운영 경보와 상태 카드 목록을 조회합니다.',
			parameters: { type: 'object', properties: {}, additionalProperties: false }
		},
		execute: (hospitalId) => listAlerts({ hospitalId })
	},
	{
		definition: {
			type: 'function',
			name: 'list_recent_orders',
			description: '재고 부족 및 다음주 예측을 반영한 우선 주문 목록을 조회합니다.',
			parameters: { type: 'object', properties: {}, additionalProperties: false }
		},
		execute: (hospitalId) => listRecentOrders({ hospitalId })
	},
	{
		definition: {
			type: 'function',
			name: 'list_stock_shortage_orders',
			description: '부족한 재고 주문 조회용 테이블 데이터를 조회합니다.',
			parameters: { type: 'object', properties: {}, additionalProperties: false }
		},
		execute: (hospitalId) => listStockShortageOrders({ hospitalId })
	},
	{
		definition: {
			type: 'function',
			name: 'get_current_auction_status',
			description: '현재 역경매 진행 현황과 입찰 상태를 조회합니다.',
			parameters: {
				type: 'object',
				properties: {
					range: { type: 'string', description: '조회 범위: 1m | 3m | all' }
				},
				additionalProperties: false
			}
		},
		execute: (hospitalId, args) =>
			getCurrentAuctionStatus({ hospitalId }, { range: typeof args.range === 'string' ? args.range : null })
	},
	{
		definition: {
			type: 'function',
			name: 'get_usage_forecast',
			description: '특정 약품의 실제 사용량, 예측, 상한, 하한 시계열을 조회합니다.',
			parameters: {
				type: 'object',
				properties: {
					drugId: { type: 'string' },
					start: { type: 'string', description: 'YYYY-MM-DD' },
					end: { type: 'string', description: 'YYYY-MM-DD' },
					actualEnd: { type: 'string', description: 'YYYY-MM-DD', nullable: true }
				},
				required: ['drugId', 'start', 'end'],
				additionalProperties: false
			}
		},
		execute: (hospitalId, args) =>
			getUsageForecast(
				{ hospitalId },
				{
					drugId: requireString(args.drugId, 'drugId'),
					start: requireString(args.start, 'start'),
					end: requireString(args.end, 'end'),
					actualEnd: typeof args.actualEnd === 'string' ? args.actualEnd : null
				}
			)
	},
	{
		definition: {
			type: 'function',
			name: 'list_usage_forecast_drug_options',
			description: '주어진 날짜 범위에서 예측 그래프 조회가 가능한 약품 코드 목록을 조회합니다.',
			parameters: {
				type: 'object',
				properties: {
					start: { type: 'string', description: 'YYYY-MM-DD' },
					end: { type: 'string', description: 'YYYY-MM-DD' }
				},
				required: ['start', 'end'],
				additionalProperties: false
			}
		},
		execute: (hospitalId, args) =>
			listUsageForecastDrugOptions(
				{ hospitalId },
				{
					start: requireString(args.start, 'start'),
					end: requireString(args.end, 'end')
				}
			)
	}
];

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
