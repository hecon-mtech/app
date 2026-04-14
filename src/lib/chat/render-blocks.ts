export type ChatRenderBlock =
	| {
			id: string;
			type: 'html';
			title?: string;
			html: string;
	  }
	| {
			id: string;
			type: 'table';
			title?: string;
			columns: string[];
			rows: Array<Record<string, unknown>>;
	  }
	| {
			id: string;
			type: 'echarts';
			title?: string;
			option: Record<string, unknown>;
	  };

export type AssistantPayload = {
	provider?: string;
	modelId?: string;
	providerItems?: Array<Record<string, unknown>>;
	toolTrace?: Array<Record<string, unknown>>;
	renderBlocks?: ChatRenderBlock[];
};
