import { type RetryOptions } from './types.js';
import { NetworkError, HttpError, RetryExhaustedError } from './errors.js';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  attempts: 3,
  backoff: 'exponential',
  initialDelay: 1000,
  maxDelay: 10000,
  retryOn: [408, 429, 500, 502, 503, 504],
  onRetry: () => {},
};

/**
 * Calculate delay for retry attempt
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const { backoff, initialDelay, maxDelay } = options;
  
  let delay: number;
  
  if (backoff === 'exponential') {
    delay = initialDelay * Math.pow(2, attempt - 1);
  } else {
    delay = initialDelay * attempt;
  }
  
  return Math.min(delay, maxDelay);
}

/**
 * Check if error should be retried
 */
function shouldRetry(error: Error, options: Required<RetryOptions>): boolean {
  if (error instanceof HttpError) {
    return options.retryOn.includes(error.status);
  }
  
  if (error instanceof NetworkError) {
    return true;
  }
  
  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retryOptions?: RetryOptions
): Promise<T> {
  const options = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === options.attempts || !shouldRetry(lastError, options)) {
        throw lastError;
      }
      
      options.onRetry(attempt, lastError);
      
      const delay = calculateDelay(attempt, options);
      await sleep(delay);
    }
  }
  
  throw new RetryExhaustedError(
    `Request failed after ${options.attempts} attempts`,
    options.attempts,
    lastError!
  );
}