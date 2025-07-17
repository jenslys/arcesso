import { expect, mock, test } from 'bun:test';
import { patch, post, put, ValidationError } from '../src/index.js';
import type { StandardSchemaV1 } from '../src/types.js';

// Mock fetch globally
const mockFetch = mock();
(global as any).fetch = mockFetch;

// Reset mock between tests
function resetMocks() {
  mockFetch.mockClear();
}

// Mock Success Schema
const UserSchema: StandardSchemaV1<
  unknown,
  { id: number; name: string; email: string }
> = {
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

test('input schema validation - valid input', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await post(
    '/api/users',
    {
      name: 'John',
      email: 'john@example.com',
      age: 25,
    },
    {
      schemas: { success: UserSchema },
    }
  );

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });

  // Verify the validated input was sent
  expect(mockFetch).toHaveBeenCalledWith('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'John', email: 'john@example.com', age: 25 }),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('input schema validation - invalid input (test disabled - no input validation in new API)', async () => {
  resetMocks();

  // Mock response for the request that will be made
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await post(
    '/api/users',
    {
      name: '', // This will be sent as-is since no input validation
      email: 'john@example.com',
      age: 25,
    },
    {
      schemas: { success: UserSchema },
    }
  );

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
  expect(mockFetch).toHaveBeenCalled();
});

test('input schema validation - missing required field (test disabled - no input validation in new API)', async () => {
  resetMocks();

  // Mock response for the request that will be made
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await post(
    '/api/users',
    {
      name: 'John',
      // Missing email field - this will be sent as-is
      age: 25,
    },
    {
      schemas: { success: UserSchema },
    }
  );

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
  expect(mockFetch).toHaveBeenCalled();
});

test('input schema validation - invalid email format (test disabled - no input validation in new API)', async () => {
  resetMocks();

  // Mock response for the request that will be made
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await post(
    '/api/users',
    {
      name: 'John',
      email: 'invalid-email', // This will be sent as-is
      age: 25,
    },
    {
      schemas: { success: UserSchema },
    }
  );

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
  expect(mockFetch).toHaveBeenCalled();
});

test('input schema validation - negative age (test disabled - no input validation in new API)', async () => {
  resetMocks();

  // Mock response for the request that will be made
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await post(
    '/api/users',
    {
      name: 'John',
      email: 'john@example.com',
      age: -5, // This will be sent as-is
    },
    {
      schemas: { success: UserSchema },
    }
  );

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
  expect(mockFetch).toHaveBeenCalled();
});

test('input schema validation - works with PUT request', async () => {
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

  const result = await put(
    '/api/users/1',
    {
      name: 'John Updated',
      email: 'john.updated@example.com',
      age: 26,
    },
    {
      schemas: { success: UserSchema },
    }
  );

  expect(result).toEqual({
    id: 1,
    name: 'John Updated',
    email: 'john.updated@example.com',
  });
});

test('input schema validation - works with PATCH request', async () => {
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

  const result = await patch(
    '/api/users/1',
    {
      name: 'John Patched',
      email: 'john@example.com',
      age: 25,
    },
    {
      schemas: { success: UserSchema },
    }
  );

  expect(result).toEqual({
    id: 1,
    name: 'John Patched',
    email: 'john@example.com',
  });
});

test('input schema validation - works without input validation', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await post(
    '/api/users',
    {
      name: 'John',
      email: 'john@example.com',
      age: 25,
      extra: 'field', // This would be invalid with schema but should work without
    },
    {
      schemas: { success: UserSchema },
      // No inputSchema provided
    }
  );

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
});

test('input schema validation - works with null body', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'Default', email: 'default@example.com' }),
    {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await post('/api/users', null, {
    schemas: { success: UserSchema },
  });

  expect(result).toEqual({
    id: 1,
    name: 'Default',
    email: 'default@example.com',
  });

  // Should send empty body
  expect(mockFetch).toHaveBeenCalledWith('/api/users', {
    method: 'POST',
    body: '',
    headers: {},
  });
});
