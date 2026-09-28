export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'FEATURE_DISABLED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'STAGE_RULE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

/** An error that maps 1:1 to the API error envelope `{ error: { code, message, details? } }`. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Shape of zod `flatten()` so VALIDATION_ERROR details are consistent everywhere. */
export const flatDetails = (formErrors: string[], fieldErrors: Record<string, string[]> = {}) => ({ formErrors, fieldErrors });

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, details ?? flatDetails([message]));
export const unauthenticated = (message = 'Authentication required') => new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission to do this') => new AppError(403, 'FORBIDDEN', message);
export const featureDisabled = (feature: string) =>
  new AppError(403, 'FEATURE_DISABLED', `The "${feature}" feature is not enabled for your organisation`, { feature });
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message: string, details?: unknown) => new AppError(409, 'CONFLICT', message, details);
export const stageRule = (reasons: string[]) =>
  new AppError(422, 'STAGE_RULE', reasons[0] ?? 'Workflow rule violated', { reasons });
