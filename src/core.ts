import {
  HttpError,
  NetworkError,
  TimeoutError,
  ValidationError,
} from './errors.js';
import { EnhancedResponse } from './response.js';
import { withRetry } from './retry.js';
import type { RetryOptions } from './types.js';

export interface CoreHttpOptions {
  method: string;
  body?: string | FormData | Blob | ArrayBuffer | ReadableStream;
  headers?: Record<string, string> | Headers;
  retry?: RetryOptions;
  timeout?: number;
  errorSchema?: import('./types.js').StandardSchemaV1;
}

/**
 * Core HTTP function - A simple fetch wrapper with retry logic and timeout
 */
export async function executeHttpRequest(
  url: string,
  options: CoreHttpOptions
): Promise<EnhancedResponse> {
  const { method, body, headers, retry, timeout, errorSchema } = options;

  const fetchWithRetry = async (): Promise<EnhancedResponse> => {
    try {
      const fetchOptions: RequestInit = {
        method,
        body,
        headers,
      };

      if (timeout) {
        fetchOptions.signal = AbortSignal.timeout(timeout);
      }

      const response = await fetch(url, fetchOptions);

      const enhancedResponse = EnhancedResponse.from(response);

      if (!response.ok) {
        if (errorSchema) {
          try {
            const responseClone = response.clone();
            const enhancedResponseClone = EnhancedResponse.from(responseClone as Response);
            const errorData = await enhancedResponseClone.json(errorSchema);
            const httpError = new HttpError(
              `HTTP ${response.status}: ${response.statusText}`,
              response as Response,
              errorData
            );
            throw httpError;
          } catch (validationError) {
            if (validationError instanceof ValidationError) {
              const httpError = new HttpError(
                `HTTP ${response.status}: ${response.statusText}`,
                response as Response
              );
              throw httpError;
            }
            throw validationError;
          }
        } else {
          const httpError = new HttpError(
            `HTTP ${response.status}: ${response.statusText}`,
            response as Response
          );
          throw httpError;
        }
      }

      return enhancedResponse;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' ||
          (error.name === 'AbortError' && timeout))
      ) {
        const timeoutError = new TimeoutError(
          `Request timed out after ${timeout}ms`,
          timeout || 0
        );
        throw timeoutError;
      }

      const networkError = new NetworkError(
        `Network error: ${(error as Error).message}`,
        error as Error
      );

      throw networkError;
    }
  };

  const response = retry
    ? await withRetry(fetchWithRetry, retry)
    : await fetchWithRetry();

  return response;
}
