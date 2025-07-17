import { expect, test } from 'bun:test';
import { z } from 'zod';
import { executeCallback } from '../src/callback-validator.js';
import { ValidationError } from '../src/errors.js';

const TestSchema = z.object({
  name: z.string(),
  age: z.number(),
});

test('executeCallback - simple callback without schema', async () => {
  const callback = (input: string) => `Hello ${input}`;
  const result = await executeCallback(callback, 'World');
  expect(result).toBe('Hello World');
});

test('executeCallback - callback with valid schema result', async () => {
  const callback = {
    schema: TestSchema,
    handler: (input: string) => ({
      name: input,
      age: 25,
    }),
  };

  const result = await executeCallback(callback, 'John');
  expect(result).toEqual({ name: 'John', age: 25 });
});

test('executeCallback - callback with invalid schema result throws ValidationError', async () => {
  const callback = {
    schema: TestSchema,
    handler: (input: string) => ({
      name: input,
      age: 'invalid', // Should be number
    }),
  };

  try {
    await executeCallback(callback, 'John');
    expect.unreachable('Should have thrown ValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain('Callback result validation failed');
  }
});

test('executeCallback - callback with missing required field throws ValidationError', async () => {
  const callback = {
    schema: TestSchema,
    handler: (input: string) => ({
      name: input,
      // Missing required 'age' field
    }),
  };

  try {
    await executeCallback(callback, 'John');
    expect.unreachable('Should have thrown ValidationError');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain('Callback result validation failed');
  }
});

test('executeCallback - undefined callback returns input', async () => {
  const result = await executeCallback(undefined, 'test');
  expect(result).toBe('test');
});

test('executeCallback - callback returning undefined falls back to input', async () => {
  const callback = (_input: string) => undefined;
  const result = await executeCallback(callback, 'test');
  expect(result).toBe('test');
});
