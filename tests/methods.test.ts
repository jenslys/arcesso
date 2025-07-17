import { expect, mock, test } from 'bun:test';
import * as v from 'valibot';
import { z } from 'zod';
import { ValidationError } from '../src/errors.js';
import {
  configure,
  delete as del,
  get,
  patch,
  post,
  put,
} from '../src/methods.js';

// Mock fetch globally
const mockFetch = mock();
(global as any).fetch = mockFetch;

function resetMocks() {
  mockFetch.mockClear();
  // Reset global config
  configure({});
}

// Test schemas
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const _CreateUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

const ValibotUserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

test('get - with schema returns typed data', async () => {
  resetMocks();

  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const user = await get('/users/1', { schemas: { success: UserSchema } });

  expect(user).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
  expect(mockFetch).toHaveBeenCalledWith('/users/1', {
    method: 'GET',
    body: '',
    headers: {},
  });
});

test('get - without schema returns raw data', async () => {
  resetMocks();

  const mockResponse = new Response(JSON.stringify({ id: 1, name: 'John' }), {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  });

  mockFetch.mockResolvedValueOnce(mockResponse);

  const data = await get('/users/1', {});

  expect(data).toEqual({ id: 1, name: 'John' });
});

test('post - with schema and automatic JSON handling', async () => {
  resetMocks();

  const mockResponse = new Response(
    JSON.stringify({ id: 2, name: 'Jane', email: 'jane@example.com' }),
    {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const userData = { name: 'Jane', email: 'jane@example.com' };
  const user = await post('/users', userData, {
    schemas: { success: UserSchema },
  });

  expect(user).toEqual({ id: 2, name: 'Jane', email: 'jane@example.com' });
  expect(mockFetch).toHaveBeenCalledWith('/users', {
    method: 'POST',
    body: JSON.stringify(userData),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('post - without schema', async () => {
  resetMocks();

  const mockResponse = new Response(JSON.stringify({ success: true }), {
    status: 201,
    statusText: 'Created',
    headers: { 'Content-Type': 'application/json' },
  });

  mockFetch.mockResolvedValueOnce(mockResponse);

  const userData = { name: 'Jane', email: 'jane@example.com' };
  const result = await post('/users', userData);

  expect(result).toEqual({ success: true });
  expect(mockFetch).toHaveBeenCalledWith('/users', {
    method: 'POST',
    body: JSON.stringify(userData),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('put - with schema and automatic JSON handling', async () => {
  resetMocks();

  const mockResponse = new Response(
    JSON.stringify({
      id: 1,
      name: 'John Updated',
      email: 'john.updated@example.com',
    }),
    {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const userData = { name: 'John Updated', email: 'john.updated@example.com' };
  const user = await put('/users/1', userData, {
    schemas: { success: UserSchema },
  });

  expect(user).toEqual({
    id: 1,
    name: 'John Updated',
    email: 'john.updated@example.com',
  });
  expect(mockFetch).toHaveBeenCalledWith('/users/1', {
    method: 'PUT',
    body: JSON.stringify(userData),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('delete - with schema', async () => {
  resetMocks();

  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const user = await del('/users/1', { schemas: { success: UserSchema } });

  expect(user).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
  expect(mockFetch).toHaveBeenCalledWith('/users/1', {
    method: 'DELETE',
    body: '',
    headers: {},
  });
});

test('patch - with schema and automatic JSON handling', async () => {
  resetMocks();

  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John Patched', email: 'john@example.com' }),
    {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const userData = { name: 'John Patched' };
  const user = await patch('/users/1', userData, {
    schemas: { success: UserSchema },
  });

  expect(user).toEqual({
    id: 1,
    name: 'John Patched',
    email: 'john@example.com',
  });
  expect(mockFetch).toHaveBeenCalledWith('/users/1', {
    method: 'PATCH',
    body: JSON.stringify(userData),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('global configuration - baseUrl and headers', async () => {
  resetMocks();

  configure({
    baseUrl: 'https://api.example.com',
    headers: { Authorization: 'Bearer token' },
  });

  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const user = await get('/users/1', { schemas: { success: UserSchema } });

  expect(user).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
  expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/users/1', {
    method: 'GET',
    body: '',
    headers: { Authorization: 'Bearer token' },
  });

  // Reset config
  configure({});
});

test('callback functions with type safety', async () => {
  resetMocks();

  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const user = await get('/users/1', {
    schemas: { success: UserSchema },
    onSuccess: (data) => {
      // data is typed as { id: number; name: string; email: string; }
      expect(data).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
      return data; // Keep it simple for testing
    },
  });

  expect(user).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
});

test('validation error handling', async () => {
  resetMocks();

  const mockResponse = new Response(
    JSON.stringify({ id: 'invalid', name: 'John' }), // missing email, invalid id
    {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/users/1', {
    schemas: { success: UserSchema },
    onValidationError: (error) => {
      console.log('onValidationError called with:', error);
      expect(error).toBeInstanceOf(ValidationError);
      return null; // Return null instead of custom object
    },
  });

  console.log('Final result:', result);
  expect(result).toBeNull();
});

test('works with Valibot schema', async () => {
  resetMocks();

  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const user = await get('/users/1', {
    schemas: { success: ValibotUserSchema },
  });

  expect(user).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
});

test('handles different body types', async () => {
  resetMocks();

  const mockResponse = new Response(JSON.stringify({ success: true }), {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  });

  mockFetch.mockResolvedValueOnce(mockResponse);

  const formData = new FormData();
  formData.append('name', 'John');

  const result = await post('/users', formData);

  expect(result).toEqual({ success: true });
  // FormData should be passed through directly without extra headers
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, options] = mockFetch.mock.calls[0] as [string, any];
  expect(url).toBe('/users');
  expect(options.method).toBe('POST');
  expect(options.body).toBe(formData);
});

test('custom headers override global headers', async () => {
  resetMocks();

  configure({
    headers: { Authorization: 'Bearer token', 'X-Custom': 'global' },
  });

  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const user = await get('/users/1', {
    schemas: { success: UserSchema },
    headers: { 'X-Custom': 'local', 'X-New': 'header' },
  });

  expect(user).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, options] = mockFetch.mock.calls[0] as [string, any];
  expect(url).toBe('/users/1');
  expect(options.method).toBe('GET');
  expect(options.headers).toEqual({
    Authorization: 'Bearer token',
    'X-Custom': 'local',
    'X-New': 'header',
  });

  // Reset config
  configure({});
});
