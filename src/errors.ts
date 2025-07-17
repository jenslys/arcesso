/**
 * Custom error types for Arcesso
 */

export class ValidationError extends Error {
  override readonly name = 'ValidationError';
  readonly issues: readonly unknown[];

  constructor(message: string, issues: readonly unknown[] = []) {
    super(message);
    this.issues = issues;
  }
}

export class NetworkError extends Error {
  override readonly name = 'NetworkError';
  override readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.cause = cause;
  }
}

export class HttpError extends Error {
  override readonly name = 'HttpError';
  readonly status: number;
  readonly statusText: string;
  readonly response: Response;
  readonly data?: unknown;

  constructor(message: string, response: Response, data?: unknown) {
    super(message);
    this.status = response.status;
    this.statusText = response.statusText;
    this.response = response;
    this.data = data;
  }
}

export class RetryExhaustedError extends Error {
  override readonly name = 'RetryExhaustedError';
  readonly attempts: number;
  readonly lastError: Error;

  constructor(message: string, attempts: number, lastError: Error) {
    super(message);
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

export class TimeoutError extends Error {
  override readonly name = 'TimeoutError';
  readonly timeout: number;

  constructor(message: string, timeout: number) {
    super(message);
    this.timeout = timeout;
  }
}
