# Arcesso

A modern, lightweight TypeScript HTTP client that's **zero dependencies** (13KB), **universal** (works in browsers and servers), and built on **native fetch**. Features Standard Schema validation, retry logic, timeout support, and comprehensive error handling.

[![npm version](https://badge.fury.io/js/arcesso.svg)](https://badge.fury.io/js/arcesso)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> **arcesso** _(v.)_ - from Latin, meaning "to summon" or "to fetch": the act of calling forth or retrieving something, just like how this library elegantly fetches data from APIs.

## Why Arcesso?

- **Tiny & Fast**: Only 13KB bundled, zero dependencies, built on native fetch
- **Universal**: Works in browsers, Node.js, Bun, Deno, Edge functions, and serverless
- **Type-Safe**: Full TypeScript support with Standard Schema validation (Zod, Valibot)
- **Production-Ready**: Comprehensive error handling, retries, timeouts, and auth helpers

## Installation

```bash
npm install arcesso
npm install zod # or valibot, arktype, etc.
```

## Quick Start

```typescript
import { get, post } from "arcesso";
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const ErrorSchema = z.object({
  error: z.string(),
  code: z.number(),
});

// GET with auth and query params
const user = await get("/api/users/1", {
  auth: { bearer: "token123" },
  query: { include: "profile" },
  schemas: {
    success: UserSchema,
    error: ErrorSchema,
  },
});

// POST with request body validation
const newUser = await post("/api/users", {
  name: "John",
  email: "john@example.com",
}, {
  auth: { bearer: "token123" },
  schemas: {
    input: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
    success: UserSchema,
    error: ErrorSchema,
  },
});
```

## Features

### Authentication
Built-in support for common auth methods:

```typescript
// Bearer token
await get("/api/users", { auth: { bearer: "jwt-token" } });

// API key
await get("/api/users", { auth: { apiKey: "api-key" } });

// Basic auth
await get("/api/users", { 
  auth: { basic: { username: "user", password: "pass" } } 
});
```

### Query Parameters
Automatic query string building:

```typescript
await get("/api/users", {
  query: { page: 1, limit: 10, active: true, filter: null }, // null values filtered out
});
// → GET /api/users?page=1&limit=10&active=true
```

### Schema Validation Pipeline
Validate requests and responses:

```typescript
await post("/api/users", userData, {
  schemas: {
    input: CreateUserSchema,    // Validates request body
    success: UserSchema,        // Validates successful response
    error: ErrorSchema,         // Validates error response
  },
});
```

### Error Handling
Type-safe error handling with callbacks:

```typescript
const user = await get("/api/users/1", {
  schemas: { success: UserSchema, error: ErrorSchema },
  onHttpError: (errorData) => {
    // errorData is typed from ErrorSchema
    console.error(`API Error: ${errorData.error} (${errorData.code})`);
    return null;
  },
  onTimeout: (error) => {
    console.error("Request timed out");
    return null;
  },
});
```

### Retry Logic
Configurable retry with exponential backoff:

```typescript
await get("/api/data", {
  retry: {
    attempts: 3,
    backoff: "exponential",
    initialDelay: 1000,
    maxDelay: 10000,
  },
});
```

### Global Configuration
Set defaults for all requests:

```typescript
import { configure } from "arcesso";

configure({
  baseUrl: "https://api.example.com",
  headers: { Authorization: "Bearer token" },
  timeout: 5000,
  retry: { attempts: 3, backoff: "exponential" },
});
```

## API Reference

### HTTP Methods

```typescript
// All methods support the same options
get(url, options?)
post(url, body, options?)
put(url, body, options?)
patch(url, body, options?)
delete(url, options?)
```

### Request Options

```typescript
interface ArcessoRequestOptions {
  schemas?: {
    input?: StandardSchemaV1;    // Validates request body
    success?: StandardSchemaV1;  // Validates successful response
    error?: StandardSchemaV1;    // Validates error response
  };
  auth?: {
    bearer?: string;
    apiKey?: string;
    basic?: { username: string; password: string };
  };
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: RetryOptions;
  // Error callbacks
  onSuccess?: CallbackOption;
  onError?: CallbackOption;
  onHttpError?: CallbackOption;
  onTimeout?: CallbackOption;
  onValidationError?: CallbackOption;
  onNetworkError?: CallbackOption;
}
```

### Error Types

- `ValidationError` - Schema validation failures
- `NetworkError` - Network connectivity issues
- `HttpError` - HTTP 4xx/5xx responses
- `TimeoutError` - Request timeouts
- `RetryExhaustedError` - All retry attempts failed

## Validation Library Support

Arcesso implements the **[Standard Schema](https://github.com/standard-schema/standard-schema) specification** locally with **zero dependencies**. Works with any validation library that supports Standard Schema:

| Library     | Status          |
| ----------- | --------------- |
| **Zod**     | ✅ Full support |
| **Valibot** | ✅ Full support |
| **ArkType** | ✅ Full support |
| **Yup**     | ✅ If Standard Schema support is added |
| **Joi**     | ✅ If Standard Schema support is added |
| **Superstruct** | ✅ If Standard Schema support is added |
| **io-ts**   | ✅ If Standard Schema support is added |
| **Any other** | ✅ If Standard Schema compatible |

```typescript
// With Zod
import { z } from "zod";
const UserSchema = z.object({ name: z.string() });

// With Valibot
import * as v from "valibot";
const UserSchema = v.object({ name: v.string() });

// Both work identically
const user = await get("/api/users/1", { schemas: { success: UserSchema } });
```

## License

MIT