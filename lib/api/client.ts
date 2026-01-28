/**
 * API client with production-grade error handling.
 *
 * Design decisions:
 *
 * 1. TIMEOUT HANDLING
 *    Every request has a timeout. A hanging request is worse than a failed one.
 *    The UI can show an error and let the user retry; a hanging spinner destroys trust.
 *
 * 2. ABORT SUPPORT
 *    React components unmount. Navigations happen. Requests in flight must be
 *    cancellable to prevent state updates on unmounted components and wasted bandwidth.
 *
 * 3. RETRY WITH BACKOFF
 *    Network failures are transient. Retry logic is built-in, but only for
 *    safe operations (GET) and explicitly retryable errors.
 *
 * 4. STRUCTURED ERRORS
 *    All errors are normalized to a consistent format. The UI should never
 *    parse raw error messages to determine behavior.
 *
 * 5. FRESHNESS METADATA
 *    Every response includes when the data was fetched and whether it came
 *    from cache. The UI decides how to present this to users.
 *
 * Production note:
 * In a real system, this client would talk to a Backend-For-Frontend (BFF)
 * or API gateway, not directly to microservices. The BFF handles:
 * - Authentication/authorization
 * - Request aggregation
 * - Response shaping
 * - Rate limiting
 * Next.js API routes serve as a lightweight BFF for this case study.
 */

import { ApiError, ApiResponse } from '@/lib/types';
import { withRetry, RetryConfig, DEFAULT_RETRY_CONFIG } from '@/lib/utils/retry';

export interface RequestConfig {
  timeout?: number;
  retries?: Partial<RetryConfig>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT = 10_000; // 10 seconds

/**
 * Create an AbortSignal that triggers on timeout OR external abort.
 */
function createTimeoutSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const cleanup = () => {
    clearTimeout(timeoutId);
  };

  // Forward external abort
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort());
    }
  }

  return { signal: controller.signal, cleanup };
}

/**
 * Parse error response into structured ApiError.
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const body = await response.json();
    if (body.code && body.message) {
      return body as ApiError;
    }
    return {
      code: `HTTP_${response.status}`,
      message: body.message || body.error || response.statusText,
      retryable: response.status >= 500 || response.status === 429,
      retryAfterMs: response.status === 429
        ? parseInt(response.headers.get('Retry-After') || '1000', 10) * 1000
        : undefined,
    };
  } catch {
    return {
      code: `HTTP_${response.status}`,
      message: response.statusText,
      retryable: response.status >= 500,
    };
  }
}

/**
 * Core fetch wrapper with timeout and abort handling.
 */
async function fetchWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<T> {
  const { signal: timeoutSignal, cleanup } = createTimeoutSignal(
    timeoutMs,
    init.signal as AbortSignal | undefined
  );

  try {
    const response = await fetch(url, {
      ...init,
      signal: timeoutSignal,
    });

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      throw error;
    }

    return await response.json();
  } catch (error) {
    // Convert timeout abort to a clearer error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: `Request timed out after ${timeoutMs}ms`,
        retryable: true,
      } as ApiError;
    }

    // Network errors
    if (error instanceof TypeError) {
      throw {
        code: 'NETWORK_ERROR',
        message: 'Network request failed. Check your connection.',
        retryable: true,
      } as ApiError;
    }

    throw error;
  } finally {
    cleanup();
  }
}

/**
 * API client class.
 * Instantiate once per application.
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * GET request with automatic retry.
   * GETs are safe to retry on failure.
   */
  async get<T>(
    path: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retries };

    return withRetry(
      () =>
        fetchWithTimeout<ApiResponse<T>>(
          url,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...config.headers,
            },
            signal: config.signal,
          },
          timeout
        ),
      retryConfig,
      config.signal
    );
  }

  /**
   * POST request without automatic retry.
   * POSTs are NOT safe to retry without idempotency keys.
   * The caller must handle retries explicitly.
   */
  async post<T>(
    path: string,
    body: unknown,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;

    return fetchWithTimeout<ApiResponse<T>>(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(body),
        signal: config.signal,
      },
      timeout
    );
  }

  /**
   * PATCH request without automatic retry.
   */
  async patch<T>(
    path: string,
    body: unknown,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;

    return fetchWithTimeout<ApiResponse<T>>(
      url,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(body),
        signal: config.signal,
      },
      timeout
    );
  }

  /**
   * DELETE request without automatic retry.
   */
  async delete<T>(
    path: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;

    return fetchWithTimeout<ApiResponse<T>>(
      url,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        signal: config.signal,
      },
      timeout
    );
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// Re-export for direct use
export { ApiClient };
