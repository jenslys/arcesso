import type { NetworkError, TimeoutError, ValidationError } from './errors.js';

// Local Standard Schema interface (zero dependencies!)
/** The Standard Schema interface. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Validates unknown input values. */
    readonly validate: (
      value: unknown
    ) => Result<Output> | Promise<Result<Output>>;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
  }

  /** The result interface of the validate function. */
  export type Result<Output> = SuccessResult<Output> | FailureResult;

  /** The result interface if validation succeeds. */
  export interface SuccessResult<Output> {
    /** The typed output value. */
    readonly value: Output;
    /** The non-existent issues. */
    readonly issues?: undefined;
  }

  /** The result interface if validation fails. */
  export interface FailureResult {
    /** The issues of failed validation. */
    readonly issues: ReadonlyArray<Issue>;
  }

  /** The issue interface of the failure output. */
  export interface Issue {
    /** The error message of the issue. */
    readonly message: string;
    /** The path of the issue, if any. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  /** The path segment interface of the issue. */
  export interface PathSegment {
    /** The key representing a path segment. */
    readonly key: PropertyKey;
  }

  /** The Standard Schema types interface. */
  export interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }

  /** Infers the input type of a Standard Schema. */
  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['input'];
  /** Infers the output type of a Standard Schema. */
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['output'];
}

// Type helper to extract Output type from schema
export type InferOutput<T> = T extends StandardSchemaV1<any, infer Output>
  ? Output
  : never;

// Type helper to extract Input type from schema
export type InferInput<T> = T extends StandardSchemaV1<infer Input, any>
  ? Input
  : never;

/**
 * Configuration options for request retry logic
 */
export interface RetryOptions {
  /** Number of retry attempts */
  attempts: number;
  /** Backoff strategy between retries */
  backoff?: 'linear' | 'exponential';
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** HTTP status codes to retry on */
  retryOn?: number[];
  /** Callback function called on each retry attempt */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Callback with schema validation for return value
 */
export interface CallbackWithSchema<TInput, TSchema extends StandardSchemaV1> {
  /** Schema to validate callback return value */
  schema: TSchema;
  /** Callback function */
  handler: (input: TInput) => unknown;
}

/**
 * Simple callback without schema validation
 */
export type SimpleCallback<TInput> = (input: TInput) => unknown;

/**
 * Union type for callbacks that can optionally have schema validation
 */
export type CallbackOption<
  TInput,
  TSchema extends StandardSchemaV1 = StandardSchemaV1,
> = SimpleCallback<TInput> | CallbackWithSchema<TInput, TSchema>;

/**
 * Schema definitions for request/response validation pipeline
 */
export interface Schemas<
  TInput extends StandardSchemaV1 = StandardSchemaV1,
  TSuccess extends StandardSchemaV1 = StandardSchemaV1,
  TError extends StandardSchemaV1 = StandardSchemaV1,
> {
  /** Schema to validate request body before sending */
  input?: TInput;
  /** Schema to validate successful response data */
  success?: TSuccess;
  /** Schema to validate error response data */
  error?: TError;
}

/**
 * Authentication options for HTTP requests
 */
export interface AuthOptions {
  /** Bearer token (JWT, etc.) */
  bearer?: string;
  /** API key for Authorization header */
  apiKey?: string;
  /** Basic authentication credentials */
  basic?: {
    username: string;
    password: string;
  };
}

/**
 * Request options for Arcesso HTTP methods
 */
export interface ArcessoRequestOptions<
  TInput extends StandardSchemaV1 = StandardSchemaV1,
  TSuccess extends StandardSchemaV1 = StandardSchemaV1,
  TError extends StandardSchemaV1 = StandardSchemaV1,
> {
  /** Schema definitions for input/success/error validation */
  schemas?: Schemas<TInput, TSuccess, TError>;
  /** Authentication options */
  auth?: AuthOptions;
  /** Query parameters to append to URL */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Custom headers */
  headers?: Record<string, string> | Headers;
  /** Retry configuration */
  retry?: RetryOptions;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Callback for successful responses */
  onSuccess?: CallbackOption<InferOutput<TSuccess>>;
  /** Callback for general errors */
  onError?: CallbackOption<Error>;
  /** Callback for network errors */
  onNetworkError?: CallbackOption<NetworkError>;
  /** Callback for validation errors */
  onValidationError?: CallbackOption<ValidationError>;
  /** Callback for HTTP errors (4xx, 5xx) */
  onHttpError?: CallbackOption<InferOutput<TError>>;
  /** Callback for timeout errors */
  onTimeout?: CallbackOption<TimeoutError>;
}

/**
 * Global configuration interface for Arcesso
 */
export interface ArcessoConfig {
  /** Base URL for all requests */
  baseUrl?: string;
  /** Default headers for all requests */
  headers?: Record<string, string>;
  /** Default retry configuration */
  retry?: RetryOptions;
  /** Default timeout in milliseconds */
  timeout?: number;
}
