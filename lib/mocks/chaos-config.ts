/**
 * Chaos configuration for failure injection.
 *
 * Production rationale:
 * This exists for demo and testing purposes. In production, you'd use
 * feature flags and chaos engineering tools (e.g., Gremlin, Chaos Monkey).
 * Here, we expose it via a hidden debug panel for live demonstrations.
 *
 * The configuration is mutable at runtime so presenters can toggle failures
 * during a demo without restarting the app.
 */

export interface ChaosConfig {
  // Latency injection
  latency: {
    enabled: boolean;
    minMs: number;
    maxMs: number;
  };

  // Random failure injection
  failures: {
    enabled: boolean;
    rate: number; // 0-1, probability of failure
  };

  // Partial outages (specific endpoints fail)
  partialOutage: {
    enabled: boolean;
    endpoints: string[]; // URL patterns that return 503
  };

  // Slow responses (simulate degraded service)
  degraded: {
    enabled: boolean;
    slowdownMultiplier: number; // e.g., 5 = 5x normal latency
    endpoints: string[];
  };

  // Stale data simulation
  staleData: {
    enabled: boolean;
    staleAgeMs: number; // How old the data appears to be
  };
}

// Default configuration: realistic latency, no failures
const defaultConfig: ChaosConfig = {
  latency: {
    enabled: true,
    minMs: 50,
    maxMs: 200,
  },
  failures: {
    enabled: false,
    rate: 0,
  },
  partialOutage: {
    enabled: false,
    endpoints: [],
  },
  degraded: {
    enabled: false,
    slowdownMultiplier: 5,
    endpoints: [],
  },
  staleData: {
    enabled: false,
    staleAgeMs: 60000,
  },
};

// Mutable runtime configuration
let currentConfig: ChaosConfig = { ...defaultConfig };

export function getChaosConfig(): ChaosConfig {
  return currentConfig;
}

export function setChaosConfig(config: Partial<ChaosConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...config,
    latency: { ...currentConfig.latency, ...config.latency },
    failures: { ...currentConfig.failures, ...config.failures },
    partialOutage: { ...currentConfig.partialOutage, ...config.partialOutage },
    degraded: { ...currentConfig.degraded, ...config.degraded },
    staleData: { ...currentConfig.staleData, ...config.staleData },
  };
}

export function resetChaosConfig(): void {
  currentConfig = { ...defaultConfig };
}

/**
 * Preset configurations for common demo scenarios.
 */
export const chaosPresets = {
  normal: defaultConfig,

  highLatency: {
    ...defaultConfig,
    latency: { enabled: true, minMs: 2000, maxMs: 5000 },
  },

  intermittentFailures: {
    ...defaultConfig,
    failures: { enabled: true, rate: 0.3 },
  },

  partialOutage: {
    ...defaultConfig,
    partialOutage: {
      enabled: true,
      endpoints: ['/api/payments', '/api/payouts'],
    },
  },

  degradedMode: {
    ...defaultConfig,
    degraded: {
      enabled: true,
      slowdownMultiplier: 10,
      endpoints: ['/api/transactions'],
    },
  },

  staleData: {
    ...defaultConfig,
    staleData: { enabled: true, staleAgeMs: 120000 },
  },

  everythingBroken: {
    latency: { enabled: true, minMs: 3000, maxMs: 8000 },
    failures: { enabled: true, rate: 0.5 },
    partialOutage: { enabled: true, endpoints: ['/api/metrics'] },
    degraded: { enabled: false, slowdownMultiplier: 1, endpoints: [] },
    staleData: { enabled: true, staleAgeMs: 300000 },
  },
} satisfies Record<string, ChaosConfig>;
