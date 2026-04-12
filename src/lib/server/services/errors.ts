export class ServiceError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'ServiceError';
		this.status = status;
	}
}

export const isServiceError = (error: unknown): error is ServiceError => error instanceof ServiceError;
