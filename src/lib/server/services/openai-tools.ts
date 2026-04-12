import {
	findAssociatedDrugs,
	getUsageForecast,
	listAlerts,
	listRecentOrders,
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

const requireString = (value: unknown, field: string) => {
	if (typeof value !== 'string' || !value.trim()) {
		throw new ServiceError(400, `${field} is required.`);
	}
	return value.trim();
};

export const OPENAI_READONLY_TOOLS: OpenAiToolDefinition[] = [
	{
		type: 'function',
		name: 'list_alerts',
		description: '현재 운영 경보와 상태 카드 목록을 조회합니다.',
		parameters: { type: 'object', properties: {}, additionalProperties: false }
	},
	{
		type: 'function',
		name: 'find_associated_drugs',
		description: '특정 약품 코드와 같은 ATC 그룹의 연관 약품 목록을 조회합니다.',
		parameters: {
			type: 'object',
			properties: {
				drugId: { type: 'string', description: '조회할 약품 코드' }
			},
			required: ['drugId'],
			additionalProperties: false
		}
	},
	{
		 type: 'function',
		name: 'list_recent_orders',
		description: '재고 부족 및 다음주 예측을 반영한 우선 주문 목록을 조회합니다.',
		parameters: { type: 'object', properties: {}, additionalProperties: false }
	},
	{
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
	{
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
	}
];

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

	switch (call.name) {
		case 'list_alerts':
			return listAlerts({ hospitalId });

		case 'find_associated_drugs':
			return findAssociatedDrugs(requireString(parsedArgs.drugId, 'drugId'));

		case 'list_recent_orders':
			return listRecentOrders({ hospitalId });

		case 'get_usage_forecast':
			return getUsageForecast(
				{ hospitalId },
				{
					drugId: requireString(parsedArgs.drugId, 'drugId'),
					start: requireString(parsedArgs.start, 'start'),
					end: requireString(parsedArgs.end, 'end'),
					actualEnd: typeof parsedArgs.actualEnd === 'string' ? parsedArgs.actualEnd : null
				}
			);

		case 'list_usage_forecast_drug_options':
			return listUsageForecastDrugOptions(
				{ hospitalId },
				{
					start: requireString(parsedArgs.start, 'start'),
					end: requireString(parsedArgs.end, 'end')
				}
			);

		default:
			throw new ServiceError(400, `Unsupported tool: ${call.name}`);
	}
};
