import type { ErrorCode } from './constants.ts';

export class FlowError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'FlowError';
    this.code = code;
    this.details = details;
  }
}
