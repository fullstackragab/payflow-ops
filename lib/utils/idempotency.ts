/**
 * Idempotency Utilities.
 *
 * Design decisions:
 *
 * 1. WHY IDEMPOTENCY MATTERS
 *    Network failures happen. Users double-click. Retries occur automatically.
 *    Without idempotency, a retry could create duplicate payments.
 *    Financial risk: Customer charged twice, merchant balance wrong.
 *
 * 2. IDEMPOTENCY KEY CONTRACT
 *    - Same key + same request = return original result (no re-execution)
 *    - Same key + different request = error (conflicting intent)
 *    - Keys expire after a period (prevents infinite storage)
 *
 * 3. CLIENT-GENERATED KEYS
 *    The client generates the key before the first request.
 *    This ensures the key exists even if the response is lost.
 *    If the server generated keys, a lost response means lost key.
 *
 * 4. KEY FORMAT
 *    Keys should be globally unique. UUIDs work well.
 *    Including a timestamp helps with debugging and expiration.
 */

/**
 * Generate a new idempotency key.
 * Format: idem_{timestamp}_{random}
 */
export function generateIdempotencyKey(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `idem_${timestamp}_${random}`;
}

/**
 * Validate idempotency key format.
 */
export function isValidIdempotencyKey(key: string): boolean {
  // Must start with idem_ and have reasonable length
  return /^idem_[a-z0-9]+_[a-z0-9]+$/.test(key) && key.length >= 15;
}

/**
 * Idempotency result types.
 */
export type IdempotencyResult<T> =
  | { type: 'new'; key: string } // First time seeing this key
  | { type: 'duplicate'; originalResult: T } // Key seen, return cached result
  | { type: 'conflict'; message: string }; // Key seen with different request

/**
 * In-memory idempotency store for demo purposes.
 *
 * Production note:
 * In a real system, this would be:
 * - Redis with TTL for distributed systems
 * - Or a database table with cleanup jobs
 * - With serializable isolation to prevent races
 */
export class IdempotencyStore<T> {
  private store = new Map<
    string,
    {
      result: T;
      requestHash: string;
      createdAt: number;
    }
  >();

  private ttlMs: number;

  constructor(ttlMs = 24 * 60 * 60 * 1000) {
    // Default 24 hours
    this.ttlMs = ttlMs;
  }

  /**
   * Check if a key exists and matches the request.
   */
  check(key: string, requestHash: string): IdempotencyResult<T> {
    const existing = this.store.get(key);

    if (!existing) {
      return { type: 'new', key };
    }

    // Check for expiration
    if (Date.now() - existing.createdAt > this.ttlMs) {
      this.store.delete(key);
      return { type: 'new', key };
    }

    // Check for request match
    if (existing.requestHash !== requestHash) {
      return {
        type: 'conflict',
        message:
          'Idempotency key already used with different request parameters',
      };
    }

    // Return cached result
    return { type: 'duplicate', originalResult: existing.result };
  }

  /**
   * Store a result for a key.
   */
  store_result(key: string, requestHash: string, result: T): void {
    this.store.set(key, {
      result,
      requestHash,
      createdAt: Date.now(),
    });
  }

  /**
   * Clear expired entries (would be a background job in production).
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    this.store.forEach((value, key) => {
      if (now - value.createdAt > this.ttlMs) {
        this.store.delete(key);
        removed++;
      }
    });

    return removed;
  }
}

/**
 * Create a hash of request parameters for conflict detection.
 * Simple implementation for demo - production would use proper hashing.
 */
export function hashRequest(params: Record<string, unknown>): string {
  return JSON.stringify(params, Object.keys(params).sort());
}
