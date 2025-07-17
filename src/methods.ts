import { executeCallback } from './callback-validator.js';
import { executeHttpRequest } from './core.js';
import {
  HttpError,
  NetworkError,
  TimeoutError,
  ValidationError,
} from './errors.js';
import type {
  ArcessoConfig,
  ArcessoRequestOptions,
  AuthOptions,
  InferOutput,
  StandardSchemaV1,
} from './types.js';

let globalConfig: ArcessoConfig = {};

/**
 * Configure global settings for Arcesso HTTP client
 * @param config - Global configuration options including baseUrl, headers, retry settings, and timeout
 * @example
 * ```typescript
 * configure({
 *   baseUrl: 'https://api.example.com',
 *   headers: { 'Authorization': 'Bearer token' },
 *   timeout: 5000,
 *   retry: { attempts: 3, backoff: 'exponential' }
 * });
 * ```
 */
function configure(config: ArcessoConfig): void {
  globalConfig = { ...config };
}

function resolveUrl(url: string): string {
  if (globalConfig.baseUrl && !url.startsWith('http')) {
    return `${globalConfig.baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  }
  return url;
}

function mergeHeaders(
  headers?: Record<string, string> | Headers
): Record<string, string> {
  const merged = { ...globalConfig.headers };

  if (headers) {
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        merged[key] = value;
      });
    } else {
      Object.assign(merged, headers);
    }
  }

  return merged;
}

function prepareBody(body: unknown): {
  body: string | FormData | Blob | ArrayBuffer | ReadableStream;
  headers: Record<string, string>;
} {
  if (body === null || body === undefined) {
    return { body: '', headers: {} };
  }

  if (typeof body === 'string') {
    return { body, headers: {} };
  }

  if (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof ReadableStream
  ) {
    return { body, headers: {} };
  }

  return {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

function prepareAuthHeaders(auth: AuthOptions): Record<string, string> {
  const headers: Record<string, string> = {};

  if (auth.bearer) {
    headers.Authorization = `Bearer ${auth.bearer}`;
  } else if (auth.apiKey) {
    headers.Authorization = `ApiKey ${auth.apiKey}`;
  } else if (auth.basic) {
    const encoded = btoa(`${auth.basic.username}:${auth.basic.password}`);
    headers.Authorization = `Basic ${encoded}`;
  }

  return headers;
}

function prepareUrl(
  url: string,
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  if (!query) {
    return url;
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) {
      params.append(key, String(value));
    }
  }

  const queryString = params.toString();
  if (queryString) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${queryString}`;
  }

  return url;
}

async function executeHttpRequestWithCallbacks<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  method: string,
  url: string,
  body: unknown,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> = {}
): Promise<
  TSuccess extends StandardSchemaV1 ? InferOutput<TSuccess> : unknown
> {
  const baseUrl = resolveUrl(url);
  const finalUrl = prepareUrl(baseUrl, options.query);

  let validatedBody = body;
  if (options.schemas?.input && body !== undefined && body !== null) {
    const result = await options.schemas.input['~standard'].validate(body);
    if ('value' in result && result.value !== undefined && !result.issues) {
      validatedBody = result.value;
    } else if ('issues' in result && result.issues) {
      throw new ValidationError(
        `Input validation failed: ${result.issues[0]?.message || 'Unknown validation error'}`,
        result.issues
      );
    } else {
      throw new ValidationError('Unknown input validation error', []);
    }
  }

  const { body: preparedBody, headers: bodyHeaders } =
    prepareBody(validatedBody);
  const authHeaders = options.auth ? prepareAuthHeaders(options.auth) : {};
  const mergedHeaders = mergeHeaders({
    ...bodyHeaders,
    ...authHeaders,
    ...options.headers,
  });

  try {
    const response = await executeHttpRequest(finalUrl, {
      method,
      body: preparedBody,
      headers: mergedHeaders,
      retry: options.retry || globalConfig.retry,
      timeout: options.timeout || globalConfig.timeout,
      errorSchema: options.schemas?.error,
    });

    try {
      const data = options.schemas?.success
        ? await response.json(options.schemas.success)
        : await response.json();

      if (options.onSuccess) {
        return await executeCallback(options.onSuccess, data);
      }

      return data;
    } catch (error) {
      if (error instanceof ValidationError) {
        if (options.onValidationError) {
          return await executeCallback(options.onValidationError, error);
        }
        throw error;
      }
      throw error;
    }
  } catch (error) {
    if (
      error instanceof ValidationError &&
      error.message.includes('Callback result validation failed')
    ) {
      throw error;
    }

    if (error instanceof HttpError && options.onHttpError) {
      const callbackInput =
        error.data !== undefined ? error.data : error.response;
      return await executeCallback(options.onHttpError, callbackInput);
    }

    if (error instanceof NetworkError && options.onNetworkError) {
      return await executeCallback(options.onNetworkError, error);
    }

    if (error instanceof TimeoutError && options.onTimeout) {
      return await executeCallback(options.onTimeout, error);
    }

    if (options.onError) {
      return await executeCallback(options.onError, error as Error);
    }

    throw error;
  }
}

async function executeRequest<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  method: string,
  url: string,
  body: unknown,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> = {}
): Promise<InferOutput<TSuccess>> {
  return executeHttpRequestWithCallbacks(method, url, body, options);
}

async function executeRequestWithoutSchema<
  TInput extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  method: string,
  url: string,
  body: unknown,
  options: ArcessoRequestOptions<TInput, StandardSchemaV1, TError> = {}
): Promise<unknown> {
  return executeHttpRequestWithCallbacks(method, url, body, options);
}

/**
 * Performs a GET request with optional schema validation
 * @param url - The URL to make the request to
 * @param options - Request options including schemas, auth, query params, and error callbacks
 * @returns Promise resolving to the validated response data
 * @example
 * ```typescript
 * // With schema validation
 * const user = await get('/api/users/1', {
 *   auth: { bearer: 'token123' },
 *   schemas: { success: UserSchema, error: ErrorSchema },
 *   query: { include: 'profile' }
 * });
 *
 * // Without schema validation
 * const data = await get('/api/data');
 * ```
 */
function get<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  url: string,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> & {
    schemas: { success: TSuccess };
  }
): Promise<InferOutput<TSuccess>>;

function get<TInput extends StandardSchemaV1, TError extends StandardSchemaV1>(
  url: string,
  options?: ArcessoRequestOptions<TInput, StandardSchemaV1, TError>
): Promise<unknown>;

function get<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  url: string,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> = {}
): Promise<InferOutput<TSuccess> | unknown> {
  if (options.schemas?.success) {
    return executeRequest('GET', url, undefined, options);
  } else {
    return executeRequestWithoutSchema('GET', url, undefined, options);
  }
}

/**
 * Performs a POST request with automatic JSON handling and optional schema validation
 * @param url - The URL to make the request to
 * @param body - The request body data (will be JSON stringified automatically)
 * @param options - Request options including schemas, auth, query params, and error callbacks
 * @returns Promise resolving to the validated response data
 * @example
 * ```typescript
 * const newUser = await post('/api/users', {
 *   name: 'John',
 *   email: 'john@example.com'
 * }, {
 *   auth: { bearer: 'token123' },
 *   schemas: {
 *     input: CreateUserSchema,
 *     success: UserSchema,
 *     error: ErrorSchema
 *   }
 * });
 * ```
 */
function post<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  url: string,
  body: unknown,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> & {
    schemas: { success: TSuccess };
  }
): Promise<InferOutput<TSuccess>>;

function post<TInput extends StandardSchemaV1, TError extends StandardSchemaV1>(
  url: string,
  body?: unknown,
  options?: ArcessoRequestOptions<TInput, StandardSchemaV1, TError>
): Promise<unknown>;

function post<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  url: string,
  body: unknown = undefined,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> = {}
): Promise<InferOutput<TSuccess> | unknown> {
  if (options.schemas?.success) {
    return executeRequest('POST', url, body, options);
  } else {
    return executeRequestWithoutSchema('POST', url, body, options);
  }
}

/**
 * Performs a PUT request with automatic JSON handling and optional schema validation
 * @param url - The URL to make the request to
 * @param body - The request body data (will be JSON stringified automatically)
 * @param options - Request options including schemas, auth, query params, and error callbacks
 * @returns Promise resolving to the validated response data
 * @example
 * ```typescript
 * const updatedUser = await put('/api/users/1', {
 *   name: 'John Updated',
 *   email: 'john.updated@example.com'
 * }, {
 *   auth: { bearer: 'token123' },
 *   schemas: { success: UserSchema }
 * });
 * ```
 */
function put<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  url: string,
  body: unknown,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> & {
    schemas: { success: TSuccess };
  }
): Promise<InferOutput<TSuccess>>;

function put<TInput extends StandardSchemaV1, TError extends StandardSchemaV1>(
  url: string,
  body?: unknown,
  options?: ArcessoRequestOptions<TInput, StandardSchemaV1, TError>
): Promise<unknown>;

function put<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  url: string,
  body: unknown = undefined,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> = {}
): Promise<InferOutput<TSuccess> | unknown> {
  if (options.schemas?.success) {
    return executeRequest('PUT', url, body, options);
  } else {
    return executeRequestWithoutSchema('PUT', url, body, options);
  }
}

/**
 * Performs a DELETE request with optional schema validation
 * @param url - The URL to make the request to
 * @param options - Request options including schemas, auth, query params, and error callbacks
 * @returns Promise resolving to the validated response data
 * @example
 * ```typescript
 * await delete('/api/users/1', {
 *   auth: { bearer: 'token123' },
 *   schemas: { success: DeleteResponseSchema }
 * });
 * ```
 */
function del<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  url: string,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> & {
    schemas: { success: TSuccess };
  }
): Promise<InferOutput<TSuccess>>;

function del<TInput extends StandardSchemaV1, TError extends StandardSchemaV1>(
  url: string,
  options?: ArcessoRequestOptions<TInput, StandardSchemaV1, TError>
): Promise<unknown>;

function del<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  url: string,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> = {}
): Promise<InferOutput<TSuccess> | unknown> {
  if (options.schemas?.success) {
    return executeRequest('DELETE', url, undefined, options);
  } else {
    return executeRequestWithoutSchema('DELETE', url, undefined, options);
  }
}

/**
 * Performs a PATCH request with automatic JSON handling and optional schema validation
 * @param url - The URL to make the request to
 * @param body - The request body data (will be JSON stringified automatically)
 * @param options - Request options including schemas, auth, query params, and error callbacks
 * @returns Promise resolving to the validated response data
 * @example
 * ```typescript
 * const patchedUser = await patch('/api/users/1', {
 *   name: 'John Patched'
 * }, {
 *   auth: { bearer: 'token123' },
 *   schemas: { success: UserSchema }
 * });
 * ```
 */
function patch<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  url: string,
  body: unknown,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> & {
    schemas: { success: TSuccess };
  }
): Promise<InferOutput<TSuccess>>;

function patch<
  TInput extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  url: string,
  body?: unknown,
  options?: ArcessoRequestOptions<TInput, StandardSchemaV1, TError>
): Promise<unknown>;

function patch<
  TInput extends StandardSchemaV1,
  TSuccess extends StandardSchemaV1,
  TError extends StandardSchemaV1,
>(
  url: string,
  body: unknown = undefined,
  options: ArcessoRequestOptions<TInput, TSuccess, TError> = {}
): Promise<InferOutput<TSuccess> | unknown> {
  if (options.schemas?.success) {
    return executeRequest('PATCH', url, body, options);
  } else {
    return executeRequestWithoutSchema('PATCH', url, body, options);
  }
}

export { configure, get, post, put, del as delete, patch };
