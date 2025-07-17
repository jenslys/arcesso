import { test, expect, mock } from 'bun:test';
import { get, post } from '../src/index.js';
import { type StandardSchemaV1 } from '../src/types.js';

// Mock fetch globally
const mockFetch = mock();
(global as any).fetch = mockFetch;

// Reset mock between tests
function resetMocks() {
  mockFetch.mockClear();
}

// Mock schema
const UserSchema: StandardSchemaV1<unknown, { id: number; name: string }> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      return { value: value as { id: number; name: string } };
    },
  },
};

test('auth - bearer token', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  await get('/api/users/1', {
    auth: { bearer: 'token123' },
    schemas: { success: UserSchema }
  });

  expect(mockFetch).toHaveBeenCalledWith('/api/users/1', {
    method: 'GET',
    body: '',
    headers: { 'Authorization': 'Bearer token123' },
  });
});

test('auth - API key', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  await get('/api/users/1', {
    auth: { apiKey: 'key123' },
    schemas: { success: UserSchema }
  });

  expect(mockFetch).toHaveBeenCalledWith('/api/users/1', {
    method: 'GET',
    body: '',
    headers: { 'Authorization': 'ApiKey key123' },
  });
});

test('auth - basic auth', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  await get('/api/users/1', {
    auth: { basic: { username: 'user', password: 'pass' } },
    schemas: { success: UserSchema }
  });

  const expectedEncoded = btoa('user:pass');
  expect(mockFetch).toHaveBeenCalledWith('/api/users/1', {
    method: 'GET',
    body: '',
    headers: { 'Authorization': `Basic ${expectedEncoded}` },
  });
});

test('auth - combined with custom headers', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  await get('/api/users/1', {
    auth: { bearer: 'token123' },
    headers: { 'X-Custom': 'value' },
    schemas: { success: UserSchema }
  });

  expect(mockFetch).toHaveBeenCalledWith('/api/users/1', {
    method: 'GET',
    body: '',
    headers: { 
      'Authorization': 'Bearer token123',
      'X-Custom': 'value'
    },
  });
});

test('query params - simple params', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  await get('/api/users', {
    query: { page: 1, limit: 10 },
    schemas: { success: UserSchema }
  });

  expect(mockFetch).toHaveBeenCalledWith('/api/users?page=1&limit=10', {
    method: 'GET',
    body: '',
    headers: {},
  });
});

test('query params - different value types', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  await get('/api/users', {
    query: { 
      page: 1, 
      active: true, 
      name: 'John',
      optional: null,
      missing: undefined
    },
    schemas: { success: UserSchema }
  });

  // null and undefined should be filtered out
  expect(mockFetch).toHaveBeenCalledWith('/api/users?page=1&active=true&name=John', {
    method: 'GET',
    body: '',
    headers: {},
  });
});

test('query params - existing query in URL', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  await get('/api/users?existing=param', {
    query: { page: 1, limit: 10 },
    schemas: { success: UserSchema }
  });

  expect(mockFetch).toHaveBeenCalledWith('/api/users?existing=param&page=1&limit=10', {
    method: 'GET',
    body: '',
    headers: {},
  });
});

test('auth and query params - combined', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  await get('/api/users', {
    auth: { bearer: 'token123' },
    query: { page: 1, limit: 10 },
    schemas: { success: UserSchema }
  });

  expect(mockFetch).toHaveBeenCalledWith('/api/users?page=1&limit=10', {
    method: 'GET',
    body: '',
    headers: { 'Authorization': 'Bearer token123' },
  });
});

test('POST with auth and query params', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John' }),
    { 
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  await post('/api/users', { name: 'John' }, {
    auth: { bearer: 'token123' },
    query: { notify: true },
    schemas: { success: UserSchema }
  });

  expect(mockFetch).toHaveBeenCalledWith('/api/users?notify=true', {
    method: 'POST',
    body: JSON.stringify({ name: 'John' }),
    headers: { 
      'Authorization': 'Bearer token123',
      'Content-Type': 'application/json'
    },
  });
});