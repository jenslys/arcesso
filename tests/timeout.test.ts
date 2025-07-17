import { expect, mock, test } from 'bun:test';
import { z } from 'zod';
import { configure, get, post, TimeoutError } from '../src/index.js';

// Mock fetch globally
const mockFetch = mock();
(global as any).fetch = mockFetch;

function resetMocks() {
  mockFetch.mockClear();
  mockFetch.mockReset();
  // Reset global config
  configure({});
}

// Helper function to create a fetch mock that respects AbortSignal
function createAbortableResponse(delay: number, response: Response) {
  return (_url: string, options?: RequestInit) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve(response);
      }, delay);

      // Handle abort signal
      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }
    });
  };
}

// Test schema
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

test('timeout - request times out with TimeoutError', async () => {
  resetMocks();

  // Mock a slow response that will timeout
  const slowResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockImplementationOnce(createAbortableResponse(2000, slowResponse));

  try {
    await get('https://api.example.com/users/1', {
      timeout: 100, // 100ms timeout
    });

    expect.unreachable('Should have thrown TimeoutError');
  } catch (error) {
    expect(error).toBeInstanceOf(TimeoutError);
    expect((error as TimeoutError).message).toContain(
      'Request timed out after 100ms'
    );
    expect((error as TimeoutError).timeout).toBe(100);
  }
});

test('timeout - request completes within timeout', async () => {
  resetMocks();

  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  );

  const result = await get('https://api.example.com/users/1', {
    timeout: 5000, // 5 second timeout
  });

  expect(result).toBeDefined();
});

test('timeout - with HTTP method shortcuts', async () => {
  resetMocks();

  // Mock a slow response
  const slowResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockImplementationOnce(createAbortableResponse(1000, slowResponse));

  try {
    await get('/users/1', {
      schemas: { success: UserSchema },
      timeout: 50, // 50ms timeout
    });

    expect.unreachable('Should have thrown TimeoutError');
  } catch (error) {
    expect(error).toBeInstanceOf(TimeoutError);
    expect((error as TimeoutError).timeout).toBe(50);
  }
});

test('timeout - with onTimeout callback', async () => {
  resetMocks();

  const slowResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockImplementationOnce(createAbortableResponse(1000, slowResponse));

  const result = await get('https://api.example.com/users/1', {
    timeout: 50,
    onTimeout: (error) => {
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.timeout).toBe(50);
      return { timedOut: true };
    },
  });

  expect(result).toEqual({ timedOut: true });
});

test('timeout - global configuration', async () => {
  resetMocks();

  configure({
    timeout: 100, // 100ms global timeout
  });

  const slowResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockImplementationOnce(createAbortableResponse(500, slowResponse));

  try {
    await get('/users/1', {
      schemas: { success: UserSchema },
    });
    expect.unreachable('Should have thrown TimeoutError');
  } catch (error) {
    expect(error).toBeInstanceOf(TimeoutError);
    expect((error as TimeoutError).timeout).toBe(100);
  }
});

test('timeout - per-request timeout overrides global timeout', async () => {
  resetMocks();

  configure({
    timeout: 50, // 50ms global timeout
  });

  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  );

  const result = await get('/users/1', {
    schemas: { success: UserSchema },
    timeout: 5000, // 5 second per-request timeout overrides global
  });

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
});

test('timeout - with retry logic', async () => {
  resetMocks();

  let attempts = 0;
  const slowResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockImplementation((url, options) => {
    attempts++;
    return createAbortableResponse(200, slowResponse)(url, options); // Each attempt takes 200ms
  });

  try {
    await get('/users/1', {
      schemas: { success: UserSchema },
      timeout: 100, // 100ms timeout per attempt
      retry: { attempts: 3 },
    });

    expect.unreachable('Should have thrown TimeoutError');
  } catch (error) {
    expect(error).toBeInstanceOf(TimeoutError);
    expect(attempts).toBe(1); // Should timeout on first attempt
  }
});

test('timeout - with different HTTP methods', async () => {
  resetMocks();

  const slowResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockImplementationOnce(createAbortableResponse(1000, slowResponse));

  const userData = { name: 'John', email: 'john@example.com' };

  try {
    await post('/users', userData, {
      schemas: { success: UserSchema },
      timeout: 50,
    });

    expect.unreachable('Should have thrown TimeoutError');
  } catch (error) {
    expect(error).toBeInstanceOf(TimeoutError);
    expect((error as TimeoutError).timeout).toBe(50);
  }
});

test('timeout - with callback schema validation', async () => {
  resetMocks();

  const slowResponse = new Response(
    JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  mockFetch.mockImplementationOnce(createAbortableResponse(1000, slowResponse));

  const ProcessedSchema = z.object({
    processed: z.boolean(),
    data: UserSchema,
  });

  const result = await get('/users/1', {
    schemas: { success: UserSchema },
    timeout: 50,
    onTimeout: {
      schema: ProcessedSchema,
      handler: (_error) => {
        return {
          processed: false,
          data: { id: 0, name: 'timeout', email: 'timeout@example.com' },
        };
      },
    },
  });

  expect(result as any).toEqual({
    processed: false,
    data: { id: 0, name: 'timeout', email: 'timeout@example.com' },
  });
});

test('timeout - no timeout specified works normally', async () => {
  resetMocks();

  mockFetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ id: 1, name: 'John', email: 'john@example.com' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  );

  const result = await get('/users/1', {
    schemas: { success: UserSchema },
  });

  expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
});
