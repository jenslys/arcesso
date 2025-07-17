import { expect, mock, test } from 'bun:test';
import {
  get,
  HttpError,
  NetworkError,
  post,
  ValidationError,
} from '../src/index.js';
import type { StandardSchemaV1 } from '../src/types.js';

// Mock fetch globally
const mockFetch = mock();
(global as any).fetch = mockFetch;

// Reset mock between tests
function resetMocks() {
  mockFetch.mockClear();
}

// Mock Standard Schema for testing
const UserSchema: StandardSchemaV1<
  unknown,
  { id: number; name: string; email: string }
> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      const data = value as any;

      // Basic validation logic for testing
      if (typeof data !== 'object' || data === null) {
        return { issues: [{ message: 'Expected object' }] };
      }

      if (typeof data.id !== 'number') {
        return { issues: [{ message: 'Expected id to be number' }] };
      }

      if (typeof data.name !== 'string') {
        return { issues: [{ message: 'Expected name to be string' }] };
      }

      if (typeof data.email !== 'string' || !data.email.includes('@')) {
        return { issues: [{ message: 'Expected email to be valid email' }] };
      }

      return { value: { id: data.id, name: data.name, email: data.email } };
    },
  },
};

test('httpkit - basic successful request', async () => {
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

  const result = await get('/api/users/1', { schemas: { success: UserSchema } });

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
  expect(mockFetch).toHaveBeenCalledWith('/api/users/1', {
    method: 'GET',
    body: '',
    headers: {},
  });
});

test('httpkit - validation error handling', async () => {
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

  const result = await get('/api/users/1', {
    schemas: { success: UserSchema },
    onValidationError: (error) => {
      expect(error).toBeInstanceOf(ValidationError);
      return { error: 'validation_failed' };
    },
  });

  expect(result as any).toEqual({ error: 'validation_failed' });
});

test('httpkit - network error handling', async () => {
  resetMocks();
  mockFetch.mockRejectedValueOnce(new Error('Network failure'));

  const result = await get('/api/users/1', {
    onNetworkError: (error) => {
      expect(error).toBeInstanceOf(NetworkError);
      return { error: 'network_failed' };
    },
  });

  expect(result).toEqual({ error: 'network_failed' });
});

test('httpkit - HTTP error handling', async () => {
  resetMocks();
  const mockResponse = new Response(JSON.stringify({}), {
    status: 404,
    statusText: 'Not Found',
    headers: { 'Content-Type': 'application/json' },
  });

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/api/users/1', {
    onHttpError: (response) => {
      expect((response as any).status).toBe(404);
      return { error: 'not_found' };
    },
  });

  expect(result).toEqual({ error: 'not_found' });
});

test('httpkit - retry logic', async () => {
  resetMocks();

  // Create fresh Response objects for each call to avoid body stream issues
  const errorResponse1 = new Response(JSON.stringify({}), {
    status: 500,
    statusText: 'Internal Server Error',
    headers: { 'Content-Type': 'application/json' },
  });

  const errorResponse2 = new Response(JSON.stringify({}), {
    status: 500,
    statusText: 'Internal Server Error',
    headers: { 'Content-Type': 'application/json' },
  });

  const successResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch
    .mockResolvedValueOnce(errorResponse1)
    .mockResolvedValueOnce(errorResponse2)
    .mockResolvedValueOnce(successResponse);

  const retryAttempts: number[] = [];

  const result = await get('/api/users/1', {
    schemas: { success: UserSchema },
    retry: {
      attempts: 3,
      backoff: 'linear',
      initialDelay: 10,
      onRetry: (attempt, error) => {
        retryAttempts.push(attempt);
        expect(error).toBeInstanceOf(HttpError);
      },
    },
  });

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
  expect(retryAttempts).toEqual([1, 2]);
  expect(mockFetch).toHaveBeenCalledTimes(3);
});

test('httpkit - POST request with body', async () => {
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

  const result = await post('/api/users', { name: 'Jane', email: 'jane@example.com' }, {
    schemas: { success: UserSchema },
  });

  expect(result).toEqual({ id: 2, name: 'Jane', email: 'jane@example.com' });
  expect(mockFetch).toHaveBeenCalledWith('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'Jane', email: 'jane@example.com' }),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('httpkit - without callbacks (standard Promise behavior)', async () => {
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

  const result = await get('/api/users/1', { schemas: { success: UserSchema } });

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
});
