import { EnhancedResponse } from './response.js';
import { NetworkError, HttpError, TimeoutError, ValidationError } from './errors.js';
import { withRetry, type RetryOptions } from './retry.js';

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
  const {
    method,
    body,
    headers,
    retry,
    timeout,
    errorSchema,
  } = options;

  const fetchWithRetry = async (): Promise<EnhancedResponse> => {
    try {
      // Create fetch options with optional timeout signal
      const fetchOptions: RequestInit = {
        method,
        body,
        headers,
      };

      // Add timeout signal if timeout is specified
      if (timeout) {
        fetchOptions.signal = AbortSignal.timeout(timeout);
      }

      const response = await fetch(url, fetchOptions);

      const enhancedResponse = EnhancedResponse.from(response);

      if (!response.ok) {
        // If we have an error schema, validate the error response
        if (errorSchema) {
          try {
            // Clone the response to avoid consuming the body stream
            const responseClone = response.clone();
            const enhancedResponseClone = EnhancedResponse.from(responseClone);
            const errorData = await enhancedResponseClone.json(errorSchema);
            // Successfully validated error response, create HttpError with validated data
            const httpError = new HttpError(
              `HTTP ${response.status}: ${response.statusText}`,
              response,
              errorData
            );
            throw httpError;
          } catch (validationError) {
            // Only catch ValidationError from schema validation, not HttpError
            if (validationError instanceof ValidationError) {
              // If error response validation fails, throw the original HTTP error
              const httpError = new HttpError(
                `HTTP ${response.status}: ${response.statusText}`,
                response
              );
              throw httpError;
            }
            // Re-throw other errors (like HttpError)
            throw validationError;
          }
        } else {
          const httpError = new HttpError(
            `HTTP ${response.status}: ${response.statusText}`,
            response
          );
          throw httpError;
        }
      }

      return enhancedResponse;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      // Handle timeout errors (from AbortSignal.timeout)
      if (error instanceof Error && (error.name === 'TimeoutError' || (error.name === 'AbortError' && timeout))) {
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