import { ValidationError } from './errors.js';
import type {
  CallbackOption,
  CallbackWithSchema,
  StandardSchemaV1,
} from './types.js';

/**
 * Check if a callback has schema validation
 */
function hasSchema<TInput>(
  callback: CallbackOption<TInput>
): callback is CallbackWithSchema<TInput, StandardSchemaV1> {
  return (
    typeof callback === 'object' &&
    callback !== null &&
    'schema' in callback &&
    'handler' in callback
  );
}

/**
 * Execute a callback with optional schema validation
 */
export async function executeCallback<TInput>(
  callback: CallbackOption<TInput> | undefined,
  input: TInput
): Promise<unknown> {
  if (!callback) {
    return input;
  }

  if (hasSchema(callback)) {
    const result = await callback.handler(input);

    const validationResult =
      await callback.schema['~standard'].validate(result);

    if (
      'value' in validationResult &&
      validationResult.value !== undefined &&
      !validationResult.issues
    ) {
      return validationResult.value;
    }

    if ('issues' in validationResult && validationResult.issues) {
      throw new ValidationError(
        `Callback result validation failed: ${validationResult.issues[0]?.message || 'Unknown validation error'}`,
        validationResult.issues
      );
    }

    throw new ValidationError(
      'Callback result validation failed: Unknown error',
      []
    );
  } else {
    const result = await callback(input);
    return result !== undefined ? result : input;
  }
}

/**
 * Type guard to check if callback has schema validation
 */
export function isCallbackWithSchema<TInput>(
  callback: CallbackOption<TInput>
): callback is CallbackWithSchema<TInput, StandardSchemaV1> {
  return hasSchema(callback);
}
