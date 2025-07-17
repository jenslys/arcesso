import { test, expect, mock } from 'bun:test';
import { get, post, ValidationError, HttpError } from '../src/index.js';
import { type StandardSchemaV1 } from '../src/types.js';

// Mock fetch globally
const mockFetch = mock();
(global as any).fetch = mockFetch;

// Reset mock between tests
function resetMocks() {
  mockFetch.mockClear();
}

// Mock Standard Schema for testing
const UserSchema: StandardSchemaV1<unknown, { id: number; name: string; email: string }> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      const data = value as any;
      
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

// Mock Error Schema for testing
const ErrorSchema: StandardSchemaV1<unknown, { error: string; code: number }> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      const data = value as any;
      
      if (typeof data !== 'object' || data === null) {
        return { issues: [{ message: 'Expected object' }] };
      }
      
      if (typeof data.error !== 'string') {
        return { issues: [{ message: 'Expected error to be string' }] };
      }
      
      if (typeof data.code !== 'number') {
        return { issues: [{ message: 'Expected code to be number' }] };
      }
      
      return { value: { error: data.error, code: data.code } };
    },
  },
};

test('error schema validation - valid error response', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ error: 'User not found', code: 404 }),
    { 
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/api/users/1', {
    schema: UserSchema,
    errorSchema: ErrorSchema,
    onHttpError: (errorData) => {
      // errorData should be the validated error response
      expect(errorData).toEqual({ error: 'User not found', code: 404 });
      return { fallback: 'error_handled' };
    },
  });

  expect(result).toEqual({ fallback: 'error_handled' });
});

test('error schema validation - invalid error response falls back to raw response', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ invalid: 'response' }), // doesn't match ErrorSchema
    { 
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/api/users/1', {
    schema: UserSchema,
    errorSchema: ErrorSchema,
    onHttpError: (errorData) => {
      // Should get the raw response since validation failed
      expect(errorData.status).toBe(500);
      expect(errorData.statusText).toBe('Internal Server Error');
      return { fallback: 'raw_response' };
    },
  });

  expect(result).toEqual({ fallback: 'raw_response' });
});

test('error schema validation - without error schema uses raw response', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ error: 'User not found', code: 404 }),
    { 
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await get('/api/users/1', {
    schema: UserSchema,
    onHttpError: (response) => {
      // Should get the raw response object
      expect(response.status).toBe(404);
      expect(response.statusText).toBe('Not Found');
      return { fallback: 'raw_response' };
    },
  });

  expect(result).toEqual({ fallback: 'raw_response' });
});

test('error schema validation - POST request with error schema', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ error: 'Validation failed', code: 400 }),
    { 
      status: 400,
      statusText: 'Bad Request',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await post('/api/users', {
    body: { invalid: 'data' },
    schema: UserSchema,
    errorSchema: ErrorSchema,
    onHttpError: (errorData) => {
      expect(errorData).toEqual({ error: 'Validation failed', code: 400 });
      return { created: false };
    },
  });

  expect(result).toEqual({ created: false });
});

test('error schema validation - HttpError contains validated data', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ error: 'Unauthorized', code: 401 }),
    { 
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  try {
    await get('/api/users/1', {
      schema: UserSchema,
      errorSchema: ErrorSchema,
      // No onHttpError callback, so should throw
    });
    expect.unreachable('Should have thrown HttpError');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    const httpError = error as HttpError;
    expect(httpError.status).toBe(401);
    expect(httpError.data).toEqual({ error: 'Unauthorized', code: 401 });
  }
});