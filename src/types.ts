import { type EnhancedResponse } from './response.js';
import { type ValidationError, type NetworkError, type HttpError, type TimeoutError } from './errors.js';

// Local Standard Schema interface (zero dependencies!)
/** The Standard Schema interface. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Validates unknown input values. */
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
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
  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["input"];
  /** Infers the output type of a Standard Schema. */
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["output"];
}

// Type helper to extract Output type from schema
export type InferOutput<T> = T extends StandardSchemaV1<any, infer Output> 
  ? Output 
  : never;

// Type helper to extract Input type from schema
export type InferInput<T> = T extends StandardSchemaV1<infer Input, any> 
  ? Input 
  : never;

export interface RetryOptions {
  attempts: number;
  backoff?: 'linear' | 'exponential';
  initialDelay?: number;
  maxDelay?: number;
  retryOn?: number[]; // HTTP status codes to retry on
  onRetry?: (attempt: number, error: Error) => void;
}

// Callback with schema validation
export interface CallbackWithSchema<TInput, TSchema extends StandardSchemaV1> {
  schema: TSchema;
  handler: (input: TInput) => unknown;
}

// Simple callback without schema validation
export type SimpleCallback<TInput> = (input: TInput) => unknown;

// Union type for callbacks that can optionally have schema validation
export type CallbackOption<TInput, TSchema extends StandardSchemaV1 = StandardSchemaV1> = 
  | SimpleCallback<TInput>
  | CallbackWithSchema<TInput, TSchema>;

// Schema definitions for request/response validation
export interface Schemas<
  TInput extends StandardSchemaV1 = StandardSchemaV1,
  TSuccess extends StandardSchemaV1 = StandardSchemaV1,
  TError extends StandardSchemaV1 = StandardSchemaV1
> {
  input?: TInput;
  success?: TSuccess;
  error?: TError;
}

// Auth options for requests
export interface AuthOptions {
  bearer?: string;
  apiKey?: string;
  basic?: {
    username: string;
    password: string;
  };
}

// Simplified options for HTTP method shortcuts
export interface HttpKitRequestOptions<
  TInput extends StandardSchemaV1 = StandardSchemaV1,
  TSuccess extends StandardSchemaV1 = StandardSchemaV1,
  TError extends StandardSchemaV1 = StandardSchemaV1
> {
  schemas?: Schemas<TInput, TSuccess, TError>;
  auth?: AuthOptions;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string> | Headers;
  retry?: RetryOptions;
  timeout?: number;
  onSuccess?: CallbackOption<InferOutput<TSuccess>>;
  onError?: CallbackOption<Error>;
  onNetworkError?: CallbackOption<NetworkError>;
  onValidationError?: CallbackOption<ValidationError>;
  onHttpError?: CallbackOption<InferOutput<TError>>;
  onTimeout?: CallbackOption<TimeoutError>;
}


// Global configuration interface
export interface HttpKitConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  retry?: RetryOptions;
  timeout?: number;
}

