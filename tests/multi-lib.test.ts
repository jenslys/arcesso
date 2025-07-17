import { test, expect, mock } from 'bun:test';
import { z } from 'zod';
import * as v from 'valibot';
import { get, post, ValidationError } from '../src/index.js';

// Mock fetch globally
const mockFetch = mock();
(global as any).fetch = mockFetch;

function resetMocks() {
  mockFetch.mockClear();
}

test('httpkit - works with Zod (Standard Schema)', async () => {
  resetMocks();
  
  const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
  });

  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/api/users/1', { schema: UserSchema });

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
});

test('httpkit - works with Valibot (Standard Schema)', async () => {
  resetMocks();
  
  const UserSchema = v.object({
    id: v.number(),
    name: v.string(),
    email: v.pipe(v.string(), v.email()),
  });

  const mockResponse = new Response(
    JSON.stringify({ id: 2, name: 'Jane', email: 'jane@example.com' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/api/users/2', { schema: UserSchema });

  expect(result).toEqual({ id: 2, name: 'Jane', email: 'jane@example.com' });
});

test('httpkit - Zod validation error handling', async () => {
  resetMocks();
  
  const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
  });

  const mockResponse = new Response(
    JSON.stringify({ id: 'invalid', name: 'John' }), // missing email, invalid id
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/api/users/1', {
    schema: UserSchema,
    onValidationError: (error) => {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.issues).toBeDefined();
      return { error: 'zod_validation_failed' };
    },
  });

  expect(result).toEqual({ error: 'zod_validation_failed' });
});

test('httpkit - Valibot validation error handling', async () => {
  resetMocks();
  
  const UserSchema = v.object({
    id: v.number(),
    name: v.string(),
    email: v.pipe(v.string(), v.email()),
  });

  const mockResponse = new Response(
    JSON.stringify({ id: 'invalid', name: 'John' }), // missing email, invalid id
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/api/users/1', {
    schema: UserSchema,
    onValidationError: (error) => {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.issues).toBeDefined();
      return { error: 'valibot_validation_failed' };
    },
  });

  expect(result).toEqual({ error: 'valibot_validation_failed' });
});

test('httpkit - Mixed validation libraries in same app', async () => {
  resetMocks();
  
  const ZodUserSchema = z.object({
    id: z.number(),
    name: z.string(),
  });

  const ValibotUserSchema = v.object({
    id: v.number(),
    email: v.pipe(v.string(), v.email()),
  });

  const mockResponse1 = new Response(
    JSON.stringify({ id: 1, name: 'John' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  const mockResponse2 = new Response(
    JSON.stringify({ id: 1, email: 'john@example.com' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch
    .mockResolvedValueOnce(mockResponse1)
    .mockResolvedValueOnce(mockResponse2);

  // Use Zod schema
  const zodResult = await get('/api/users/1', { schema: ZodUserSchema });

  // Use Valibot schema
  const valibotResult = await get('/api/users/1', { schema: ValibotUserSchema });

  expect(zodResult).toEqual({ id: 1, name: 'John' });
  expect(valibotResult).toEqual({ id: 1, email: 'john@example.com' });
});