# HTTPKit

A modern, lightweight TypeScript HTTP client that's **zero dependencies** (13KB), **universal** (works in browsers and servers), and built on **native fetch**. Features Standard Schema validation, retry logic, timeout support, and comprehensive error handling.

**Perfect for production**: Tiny bundle, type-safe validation with Zod/Valibot, and works everywhere.

## Why HTTPKit?

**Tiny & Fast**: Only 13KB bundled, zero dependencies, built on native fetch
**Universal**: Works in browsers, Node.js, Bun, Deno, Edge functions, and serverless
**Type-Safe**: Full TypeScript support with Standard Schema validation (Zod, Valibot)
**Production-Ready**: Comprehensive error handling, retries, timeouts, and auth helpers

## Features

- **Zero Dependencies**: No external dependencies, works with any Standard Schema validation library
- **Small Bundle**: Only 13KB - perfect for performance-critical applications
- **Universal**: Works everywhere - browsers, Node.js, Bun, Deno, serverless functions
- **Native Fetch**: Built on the standard Fetch API, no legacy HTTP clients
- **Type-Safe HTTP Methods**: Clean `get`, `post`, `put`, `delete`, `patch` methods with full TypeScript support
- **Complete Schema Pipeline**: Validate request bodies, success responses, and error responses
  - **Input Schema Validation**: Validate request bodies before sending (works with Zod, Valibot, etc.)
  - **Success Response Schema Validation**: Type-safe API responses
  - **Error Response Schema Validation**: Validate error responses for robust error handling
- **Built-in Auth Helpers**: Bearer tokens, API keys, and basic auth support
- **Query Parameters**: Simple object-to-query-string conversion with type safety
- **Smart Retry Logic**: Configurable retry with exponential or linear backoff
- **Timeout Support**: Request timeouts with proper error handling
- **Callback-based Error Handling**: Handle different error types with dedicated callbacks
- **Global Configuration**: Set base URL, headers, and defaults once
- **Schema Validation for Callbacks**: Validate callback return values with schemas

## Installation

```bash
bun add httpkit
bun add zod # or valibot, arktype, etc.
```

> **13KB total bundle size** - HTTPKit adds almost no weight to your application!

## Usage

### Basic Usage

```typescript
import { get, post } from "httpkit";
import { z } from "zod";

// Define schemas for the complete pipeline
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0),
});

const ErrorSchema = z.object({
  error: z.string(),
  code: z.number(),
});

// Clean, simple API with auth and query params
const user = await get("/api/users/1", {
  auth: { bearer: "token123" },
  schemas: {
    success: UserSchema,
    error: ErrorSchema,
  },
  onError: (error) => {
    console.error("Failed:", error.message);
    return null;
  },
  onHttpError: (errorData) => {
    // errorData is validated against ErrorSchema
    console.error(`API Error: ${errorData.error} (${errorData.code})`);
    return null;
  },
});

const users = await get("/api/users", {
  auth: { bearer: "token123" },
  query: { page: 1, limit: 10, active: true },
  schemas: {
    success: UserListSchema,
    error: ErrorSchema,
  },
});

const newUser = await post(
  "/api/users",
  {
    name: "John",
    email: "john@example.com",
    age: 25,
  },
  {
    auth: { bearer: "token123" },
    schemas: {
      input: CreateUserSchema, // Validates request body
      success: UserSchema, // Validates successful response
      error: ErrorSchema, // Validates error response
    },
    onHttpError: (errorData) => {
      console.error(`Creation failed: ${errorData.error}`);
      return null;
    },
  },
);
```

### Authentication

HTTPKit provides built-in auth helpers for common authentication methods:

```typescript
// Bearer token (JWT, etc.)
const user = await get("/api/users/1", {
  auth: { bearer: "your-jwt-token" },
});

// API key
const user = await get("/api/users/1", {
  auth: { apiKey: "your-api-key" },
});

// Basic auth
const user = await get("/api/users/1", {
  auth: {
    basic: {
      username: "user",
      password: "pass",
    },
  },
});

// Combined with custom headers
const user = await get("/api/users/1", {
  auth: { bearer: "token123" },
  headers: { "X-Custom": "value" },
});
```

### Query Parameters

Easily add query parameters to your requests:

```typescript
// Simple query params
const users = await get("/api/users", {
  query: { page: 1, limit: 10 },
});
// → GET /api/users?page=1&limit=10

// Different value types
const users = await get("/api/users", {
  query: {
    page: 1, // number
    active: true, // boolean
    name: "John", // string
    optional: null, // filtered out
    missing: undefined, // filtered out
  },
});
// → GET /api/users?page=1&active=true&name=John

// Works with existing query params
const users = await get("/api/users?sort=name", {
  query: { page: 1, limit: 10 },
});
// → GET /api/users?sort=name&page=1&limit=10
```

### Input Schema Validation

HTTPKit can validate request bodies before sending them to the API:

```typescript
import { post, ValidationError } from "httpkit";
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  age: z.number().min(0, "Age must be positive"),
});

// Valid input - will be validated and sent
const user = await post("/api/users", {
  body: {
    name: "John",
    email: "john@example.com",
    age: 25,
  },
  inputSchema: CreateUserSchema,
  schema: UserSchema,
});

// Invalid input - will throw ValidationError before making request
try {
  await post("/api/users", {
    body: {
      name: "", // Invalid: empty string
      email: "not-an-email", // Invalid: no @ symbol
      age: -5, // Invalid: negative number
    },
    inputSchema: CreateUserSchema,
    schema: UserSchema,
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error("Input validation failed:", error.message);
    // No HTTP request was made
  }
}
```

### Error Response Schema Validation

HTTPKit allows you to validate error responses with schemas, providing type-safe error handling:

```typescript
import { get, HttpError } from "httpkit";
import { z } from "zod";

// Define schemas for both success and error responses
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.number(),
  details: z.array(z.string()).optional(),
});

// Example 1: With error callback
const user = await get("/api/users/1", {
  schema: UserSchema,
  errorSchema: ApiErrorSchema,
  onHttpError: (errorData) => {
    // errorData is typed as { error: string; code: number; details?: string[] }
    console.error(`API Error: ${errorData.error} (${errorData.code})`);
    if (errorData.details) {
      console.error("Details:", errorData.details);
    }
    return null;
  },
});

// Example 2: Standard Promise behavior with typed errors
try {
  const user = await get("/api/users/1", {
    schema: UserSchema,
    errorSchema: ApiErrorSchema,
  });
} catch (error) {
  if (error instanceof HttpError) {
    // error.data contains the validated error response
    const errorData = error.data as { error: string; code: number };
    console.error(`API Error: ${errorData.error} (${errorData.code})`);
  }
}

// Example 3: Fallback behavior
// If error response doesn't match the schema, you get the raw Response object
const result = await get("/api/users/1", {
  schema: UserSchema,
  errorSchema: ApiErrorSchema,
  onHttpError: (errorData) => {
    if (typeof errorData === "object" && "error" in errorData) {
      // Validated error response
      console.error(`Structured error: ${errorData.error}`);
    } else {
      // Raw response (validation failed)
      console.error(`HTTP ${errorData.status}: ${errorData.statusText}`);
    }
    return null;
  },
});
```

### Global Configuration

```typescript
import { configure } from "httpkit";

configure({
  baseUrl: "https://api.example.com",
  headers: { Authorization: "Bearer token" },
  timeout: 5000,
  retry: { attempts: 3, backoff: "exponential" },
});

// Now all requests use the global config
const user = await get("/users/1", { schema: UserSchema });
```

### Error Handling

```typescript
const user = await get("/api/users/1", {
  schema: UserSchema,
  onError: (error) => {
    console.error("Request failed:", error.message);
    return null;
  },
  onTimeout: (error) => {
    console.error("Request timed out:", error.message);
    return { id: -1, name: "Timeout", email: "timeout@example.com" };
  },
  onValidationError: (error) => {
    console.error("Validation failed:", error.message);
    return { id: -1, name: "Invalid", email: "invalid@example.com" };
  },
});
```

### Retry Logic

```typescript
const data = await get("/api/data", {
  schema: DataSchema,
  retry: {
    attempts: 3,
    backoff: "exponential",
    initialDelay: 1000,
    maxDelay: 10000,
    onRetry: (attempt, error) => {
      console.log(`Retry ${attempt}: ${error.message}`);
    },
  },
});
```

### Timeout Support

```typescript
const data = await get("/api/data", {
  schema: DataSchema,
  timeout: 5000, // 5 second timeout
  onTimeout: (error) => {
    console.error("Request timed out:", error.message);
    return { fallback: "data" };
  },
});
```

### Callback Schema Validation

```typescript
import { z } from "zod";

const ProcessedDataSchema = z.object({
  success: z.boolean(),
  data: z.any(),
});

const result = await get("/api/data", {
  schema: DataSchema,
  onSuccess: {
    schema: ProcessedDataSchema,
    handler: (data) => ({ success: true, data }),
  },
  onError: {
    schema: ProcessedDataSchema,
    handler: (error) => ({ success: false, data: null }),
  },
});
// result is typed as { success: boolean; data: any }
```

### Standard Promise Behavior

```typescript
try {
  const user = await get("/api/users/1", { schema: UserSchema });
  console.log(user);
} catch (error) {
  console.error("Error:", error);
}
```

## API Reference

### HTTP Methods

```typescript
// GET request
function get<T>(
  url: string,
  options: { schema: Schema<T> } & HttpKitRequestOptions,
): Promise<T>;
function get(url: string, options?: HttpKitRequestOptions): Promise<unknown>;

// POST request
function post<T>(
  url: string,
  options: { body: unknown; schema: Schema<T> } & HttpKitRequestOptions,
): Promise<T>;
function post(url: string, options?: HttpKitRequestOptions): Promise<unknown>;

// PUT, DELETE, PATCH follow the same pattern
```

### Configuration

```typescript
function configure(config: HttpKitConfig): void;

interface HttpKitConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  retry?: RetryOptions;
  timeout?: number;
}
```

### Request Options

```typescript
interface HttpKitRequestOptions<
  TSchema = unknown,
  TErrorSchema = unknown,
  TInputSchema = unknown,
> {
  schema?: Schema<TSchema>; // Validates successful response
  errorSchema?: Schema<TErrorSchema>; // Validates error response
  inputSchema?: Schema<TInputSchema>; // Validates request body
  body?: unknown;
  headers?: Record<string, string> | Headers;
  retry?: RetryOptions;
  timeout?: number;
  onSuccess?: CallbackOption<TSchema>;
  onError?: CallbackOption<Error>;
  onNetworkError?: CallbackOption<NetworkError>;
  onValidationError?: CallbackOption<ValidationError>;
  onHttpError?: CallbackOption<TErrorSchema>; // Validated error data or raw Response
  onTimeout?: CallbackOption<TimeoutError>;
}
```

### Retry Options

```typescript
interface RetryOptions {
  attempts: number;
  backoff?: "linear" | "exponential";
  initialDelay?: number;
  maxDelay?: number;
  retryOn?: number[]; // HTTP status codes to retry on
  onRetry?: (attempt: number, error: Error) => void;
}
```

### Callback Types

```typescript
// Simple callback
type SimpleCallback<T> = (input: T) => unknown;

// Callback with schema validation
interface CallbackWithSchema<T, S> {
  schema: S;
  handler: (input: T) => unknown;
}

type CallbackOption<T> = SimpleCallback<T> | CallbackWithSchema<T, Schema>;
```

### Error Types

- `ValidationError` - Thrown when validation fails
- `NetworkError` - Thrown on network failures
- `HttpError` - Thrown on HTTP errors (4xx, 5xx)
- `RetryExhaustedError` - Thrown when retry attempts are exhausted
- `TimeoutError` - Thrown when requests timeout

## Validation Library Support

HTTPKit implements the **official [Standard Schema](https://github.com/standard-schema/standard-schema) specification** locally with **zero dependencies**. This means it works with any validation library that implements Standard Schema:

| Library     | Status          | Bundle Impact           |
| ----------- | --------------- | ----------------------- |
| **Zod**     | ✅ Full support | You choose your version |
| **Valibot** | ✅ Full support | You choose your version |
| **ArkType** | ✅ Full support | You choose your version |
| **Yup**     | 🔄 Coming soon  | -                       |
| **Joi**     | 🔄 Coming soon  | -                       |

**Zero Bundle Bloat**: HTTPKit includes the Standard Schema interface locally (1:1 copy of the official spec), so you get full validation support without any additional dependencies.

### Example with different libraries:

```typescript
// With Zod
import { z } from "zod";
const UserSchema = z.object({ name: z.string() });

// With Valibot
import * as v from "valibot";
const UserSchema = v.object({ name: v.string() });

// Both work the same way
const user = await get("/api/users/1", { schema: UserSchema });
```

## Development

```bash
bun install
bun test
```

## License

MIT
