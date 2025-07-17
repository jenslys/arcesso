import { test, expect, mock } from 'bun:test';
import { post, put, patch, ValidationError } from '../src/index.js';
import { type StandardSchemaV1 } from '../src/types.js';

// Mock fetch globally
const mockFetch = mock();
(global as any).fetch = mockFetch;

// Reset mock between tests
function resetMocks() {
  mockFetch.mockClear();
}

// Mock Input Schema for testing
const CreateUserSchema: StandardSchemaV1<unknown, { name: string; email: string; age: number }> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      const data = value as any;
      
      if (typeof data !== 'object' || data === null) {
        return { issues: [{ message: 'Expected object' }] };
      }
      
      if (typeof data.name !== 'string' || data.name.length < 1) {
        return { issues: [{ message: 'Expected name to be non-empty string' }] };
      }
      
      if (typeof data.email !== 'string' || !data.email.includes('@')) {
        return { issues: [{ message: 'Expected email to be valid email' }] };
      }
      
      if (typeof data.age !== 'number' || data.age < 0) {
        return { issues: [{ message: 'Expected age to be positive number' }] };
      }
      
      return { value: { name: data.name, email: data.email, age: data.age } };
    },
  },
};

// Mock Success Schema
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

test('input schema validation - valid input', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    { 
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await post('/api/users', {
    body: {
      name: 'John',
      email: 'john@example.com',
      age: 25
    },
    inputSchema: CreateUserSchema,
    schema: UserSchema
  });

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
  
  // Verify the validated input was sent
  expect(mockFetch).toHaveBeenCalledWith('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'John', email: 'john@example.com', age: 25 }),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('input schema validation - invalid input throws ValidationError', async () => {
  resetMocks();

  try {
    await post('/api/users', {
      body: {
        name: '', // Invalid: empty string
        email: 'john@example.com',
        age: 25
      },
      inputSchema: CreateUserSchema,
      schema: UserSchema
    });
    expect.unreachable('Should have thrown ValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain('Input validation failed');
    expect(error.message).toContain('Expected name to be non-empty string');
  }

  // Should not have made any fetch call
  expect(mockFetch).not.toHaveBeenCalled();
});

test('input schema validation - missing required field', async () => {
  resetMocks();

  try {
    await post('/api/users', {
      body: {
        name: 'John',
        // Missing email field
        age: 25
      },
      inputSchema: CreateUserSchema,
      schema: UserSchema
    });
    expect.unreachable('Should have thrown ValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain('Input validation failed');
  }

  expect(mockFetch).not.toHaveBeenCalled();
});

test('input schema validation - invalid email format', async () => {
  resetMocks();

  try {
    await post('/api/users', {
      body: {
        name: 'John',
        email: 'invalid-email', // Invalid: no @ symbol
        age: 25
      },
      inputSchema: CreateUserSchema,
      schema: UserSchema
    });
    expect.unreachable('Should have thrown ValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain('Expected email to be valid email');
  }

  expect(mockFetch).not.toHaveBeenCalled();
});

test('input schema validation - negative age', async () => {
  resetMocks();

  try {
    await post('/api/users', {
      body: {
        name: 'John',
        email: 'john@example.com',
        age: -5 // Invalid: negative age
      },
      inputSchema: CreateUserSchema,
      schema: UserSchema
    });
    expect.unreachable('Should have thrown ValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain('Expected age to be positive number');
  }

  expect(mockFetch).not.toHaveBeenCalled();
});

test('input schema validation - works with PUT request', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John Updated', email: 'john.updated@example.com' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await put('/api/users/1', {
    body: {
      name: 'John Updated',
      email: 'john.updated@example.com',
      age: 26
    },
    inputSchema: CreateUserSchema,
    schema: UserSchema
  });

  expect(result).toEqual({ id: 1, name: 'John Updated', email: 'john.updated@example.com' });
});

test('input schema validation - works with PATCH request', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John Patched', email: 'john@example.com' }),
    { 
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await patch('/api/users/1', {
    body: {
      name: 'John Patched',
      email: 'john@example.com',
      age: 25
    },
    inputSchema: CreateUserSchema,
    schema: UserSchema
  });

  expect(result).toEqual({ id: 1, name: 'John Patched', email: 'john@example.com' });
});

test('input schema validation - skipped when no inputSchema provided', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    { 
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await post('/api/users', {
    body: {
      name: 'John',
      email: 'john@example.com',
      age: 25,
      extra: 'field' // This would be invalid with schema but should work without
    },
    schema: UserSchema
    // No inputSchema provided
  });

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
});

test('input schema validation - skipped for null/undefined body', async () => {
  resetMocks();
  const mockResponse = new Response(
    JSON.stringify({ id: 1, name: 'Default', email: 'default@example.com' }),
    { 
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json' }
    }
  );

  mockFetch.mockResolvedValueOnce(mockResponse);

  const result = await post('/api/users', {
    body: null,
    inputSchema: CreateUserSchema,
    schema: UserSchema
  });

  expect(result).toEqual({ id: 1, name: 'Default', email: 'default@example.com' });
  
  // Should send empty body
  expect(mockFetch).toHaveBeenCalledWith('/api/users', {
    method: 'POST',
    body: '',
    headers: {},
  });
});