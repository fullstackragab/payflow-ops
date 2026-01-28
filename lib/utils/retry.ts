/**
 * Retry utilities with exponential backoff.
 *
 * Production rationale:
 * - Network requests fail. Retry logic is not optional.
 * - Exponential backoff prevents thundering herd on service recovery.
 * - Jitter prevents synchronized retries across clients.
 * - Abort support allows cancellation during retries.
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number; // Random variation to prevent synchronized retries
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  jitterMs: 500,
};

/**
 * Calculate delay for a given attempt with exponential backoff.
 */
export function calculateBackoff(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * config.jitterMs;
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Sleep with abort support.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/**
 * Determine if an error is retryable.
 * This is a policy decision that should match your API contract.
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Check for HTTP status in our ApiError format
  if (error && typeof error === 'object' && 'retryable' in error) {
    return (error as { retryable: boolean }).retryable;
  }

  // Abort errors are not retryable
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }

  return false;
}

/**
 * Execute a function with retry logic.
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @param signal - Optional AbortSignal for cancellation
 * @returns Result of the function
 * @throws Last error after all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  signal?: AbortSignal
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry abort errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt === fullConfig.maxAttempts) {
        break;
      }

      // Wait before next attempt
      const delay = calculateBackoff(attempt, fullConfig);
      await sleep(delay, signal);
    }
  }

  throw lastError;
}

/**
 * Retry information for UI display.
 */
export interface RetryState {
  attempt: number;
  maxAttempts: number;
  isRetrying: boolean;
  nextRetryMs: number | null;
}
