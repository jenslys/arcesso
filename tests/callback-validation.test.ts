import { test, expect, mock } from 'bun:test';
import { z } from 'zod';
import * as v from 'valibot';
import { get, post } from '../src/methods.js';
import { ValidationError } from '../src/errors.js';
import { EnhancedResponse } from '../src/response.js';

// Mock fetch globally
const mockFetch = mock();
(global as any).fetch = mockFetch;

function resetMocks() {
  mockFetch.mockClear();
  mockFetch.mockReset();
}

// Test schemas
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const ProcessedUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  processed: z.boolean(),
  timestamp: z.number(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  code: z.string(),
});

const ValibotErrorSchema = v.object({
  type: v.string(),
  details: v.string(),
  handled: v.boolean(),
});

test('onSuccess with schema validation - valid result', async () => {
  resetMocks();
  
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/users/1', {
    schema: UserSchema,
    onSuccess: {
      schema: ProcessedUserSchema,
      handler: (user) => {
        // user is typed as { id: number; name: string; email: string; }
        expect(user).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
        return {
          ...user,
          processed: true,
          timestamp: 1234567890
        };
      }
    }
  });

  expect(result).toEqual({
    id: 1,
    name: 'John',
    email: 'john@example.com',
    processed: true,
    timestamp: 1234567890
  });
});

test('onSuccess with schema validation - invalid result throws ValidationError', async () => {
  resetMocks();
  
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  try {
    const result = await get('/users/1', {
      schema: UserSchema,
      onSuccess: {
        schema: ProcessedUserSchema,
        handler: (user) => {
          // Return invalid data that doesn't match ProcessedUserSchema
          return {
            ...user,
            processed: 'invalid', // Should be boolean
            // Missing required timestamp field
          };
        }
      }
    });
    
    console.log('Result:', result);
    expect.unreachable('Should have thrown ValidationError');
  } catch (error) {
    console.log('Caught error:', error);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain('Callback result validation failed');
  }
});

test('onError with schema validation - valid result', async () => {
  resetMocks();
  
  mockFetch.mockRejectedValueOnce(new Error('Network failure'));

  const result = await get('/users/1', {
    schema: UserSchema,
    onNetworkError: {
      schema: ErrorResponseSchema,
      handler: (error) => {
        expect(error.message).toContain('Network failure');
        return {
          error: 'request_failed',
          message: 'Network failure',
          code: 'NETWORK_ERROR'
        };
      }
    }
  });

  expect(result).toEqual({
    error: 'request_failed',
    message: 'Network failure',
    code: 'NETWORK_ERROR'
  });
});

test('onError with schema validation - invalid result throws ValidationError', async () => {
  resetMocks();
  
  mockFetch.mockRejectedValueOnce(new Error('Network failure'));

  try {
    const result = await get('/users/1', {
      schema: UserSchema,
      onError: {
        schema: ErrorResponseSchema,
        handler: (error) => {
          // Return invalid data that doesn't match ErrorResponseSchema
          return {
            error: 'request_failed',
            message: error.message,
            // Missing required 'code' field
          };
        }
      }
    });
    
    expect.unreachable('Should have thrown ValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain('Callback result validation failed');
  }
});

test('onNetworkError with Valibot schema validation', async () => {
  resetMocks();
  
  mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

  const result = await get('/users/1', {
    schema: UserSchema,
    onNetworkError: {
      schema: ValibotErrorSchema,
      handler: (error) => {
        return {
          type: 'network_error',
          details: error.message,
          handled: true
        };
      }
    }
  });

  expect(result).toEqual({
    type: 'network_error',
    details: 'Network error: Connection timeout',
    handled: true
  });
});

test('onValidationError with schema validation', async () => {
  resetMocks();
  
  const mockResponse = new Response(
    JSON.stringify({ id: 'invalid', name: 'John' }), // Invalid data
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/users/1', {
    schema: UserSchema,
    onValidationError: {
      schema: ErrorResponseSchema,
      handler: (error) => {
        expect(error).toBeInstanceOf(ValidationError);
        return {
          error: 'validation_failed',
          message: error.message,
          code: 'SCHEMA_ERROR'
        };
      }
    }
  });

  expect(result).toEqual({
    error: 'validation_failed',
    message: expect.stringContaining('validation failed'),
    code: 'SCHEMA_ERROR'
  });
});

test('onHttpError with schema validation', async () => {
  resetMocks();
  
  const mockResponse = new Response(
    JSON.stringify({ error: 'Not found' }),
    { 
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/users/1', {
    schema: UserSchema,
    onHttpError: {
      schema: ErrorResponseSchema,
      handler: (response) => {
        expect(response.status).toBe(404);
        return {
          error: 'http_error',
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: 'HTTP_404'
        };
      }
    }
  });

  expect(result).toEqual({
    error: 'http_error',
    message: 'HTTP 404: Not Found',
    code: 'HTTP_404'
  });
});

test('mixed callbacks - some with schema, some without', async () => {
  resetMocks();
  
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/users/1', {
    schema: UserSchema,
    onSuccess: {
      schema: ProcessedUserSchema,
      handler: (user) => ({
        ...user,
        processed: true,
        timestamp: 1234567890
      })
    },
    onError: (error) => {
      // Simple callback without schema validation
      return { simpleError: error.message };
    }
  });

  expect(result).toEqual({
    id: 1,
    name: 'John',
    email: 'john@example.com',
    processed: true,
    timestamp: 1234567890
  });
});

test('POST request with callback schema validation', async () => {
  resetMocks();
  
  const mockResponse = new Response(
    JSON.stringify({ id: 2, name: 'Jane', email: 'jane@example.com' }),
    { 
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const userData = { name: 'Jane', email: 'jane@example.com' };
  const result = await post('/users', {
    body: userData,
    schema: UserSchema,
    onSuccess: {
      schema: ProcessedUserSchema,
      handler: (user) => ({
        ...user,
        processed: true,
        timestamp: Date.now()
      })
    }
  });

  expect(result).toEqual({
    id: 2,
    name: 'Jane',
    email: 'jane@example.com',
    processed: true,
    timestamp: expect.any(Number)
  });
});

test('callback without schema validation works as before', async () => {
  resetMocks();
  
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/users/1', {
    schema: UserSchema,
    onSuccess: (user) => {
      // Simple callback without schema validation
      return { ...user, legacy: true };
    }
  });

  expect(result).toEqual({
    id: 1,
    name: 'John',
    email: 'john@example.com',
    legacy: true
  });
});

test('async callback handlers are supported', async () => {
  resetMocks();
  
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/users/1', {
    schema: UserSchema,
    onSuccess: {
      schema: ProcessedUserSchema,
      handler: async (user) => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 1));
        return {
          ...user,
          processed: true,
          timestamp: 1234567890
        };
      }
    }
  });

  expect(result).toEqual({
    id: 1,
    name: 'John',
    email: 'john@example.com',
    processed: true,
    timestamp: 1234567890
  });
});