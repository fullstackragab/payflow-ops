/**
 * Mock data generators.
 *
 * Production rationale:
 * Mock data must be realistic enough to stress-test UI edge cases:
 * - Long merchant names that might truncate
 * - Various currency formats
 * - Edge case amounts (very small, very large)
 * - Realistic timestamp distributions
 *
 * These generators create deterministic data when given the same seed,
 * allowing reproducible demo scenarios.
 */

import type {
  Transaction,
  TransactionSummary,
  TransactionStatus,
  TransactionType,
  PaymentMethod,
  FailureReason,
  Payment,
  PaymentStatus,
  DashboardMetrics,
  RegionalMetrics,
  Incident,
  IncidentSeverity,
  IncidentStatus,
} from '@/lib/types';

// Seeded random for reproducibility
function seededRandom(seed: number): () => number {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

const random = seededRandom(42);

function randomItem<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

const MERCHANTS = [
  { id: 'merch_001', name: 'TechCorp Solutions' },
  { id: 'merch_002', name: 'Global Retail Inc' },
  { id: 'merch_003', name: 'FastFood Chain LLC' },
  { id: 'merch_004', name: 'E-Commerce Giant' },
  { id: 'merch_005', name: 'SaaS Platform Co' },
  { id: 'merch_006', name: 'Travel & Hospitality Group' },
  { id: 'merch_007', name: 'Healthcare Services Network' },
  { id: 'merch_008', name: 'Entertainment Media Corp' },
];

const REGIONS = ['US', 'EU', 'UK', 'APAC', 'LATAM', 'MEA'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];

export function generateTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const merchant = randomItem(MERCHANTS);
  const status: TransactionStatus = randomItem([
    'pending',
    'processing',
    'authorized',
    'captured',
    'settled',
    'failed',
  ]);

  const failedStatuses: TransactionStatus[] = ['failed'];
  const isFailure = failedStatuses.includes(status);

  return {
    id: generateId('txn'),
    externalId: `ext_${randomBetween(100000, 999999)}`,
    type: randomItem(['payment', 'refund']) as TransactionType,
    status,
    amount: randomBetween(100, 1000000), // $1.00 to $10,000.00
    currency: randomItem(CURRENCIES),
    paymentMethod: randomItem(['card', 'bank_transfer', 'wallet']) as PaymentMethod,
    merchantId: merchant.id,
    merchantName: merchant.name,
    customerId: `cust_${randomBetween(1000, 9999)}`,
    region: randomItem(REGIONS),
    failureReason: isFailure
      ? randomItem([
          'insufficient_funds',
          'card_declined',
          'processor_unavailable',
          'network_timeout',
        ] as FailureReason[])
      : null,
    metadata: {},
    createdAt: new Date(Date.now() - randomBetween(0, 86400000)).toISOString(),
    updatedAt: new Date().toISOString(),
    settledAt: status === 'settled' ? new Date().toISOString() : null,
    ...overrides,
  };
}

export function generateTransactionSummary(
  overrides: Partial<TransactionSummary> = {}
): TransactionSummary {
  const txn = generateTransaction();
  return {
    id: txn.id,
    type: txn.type,
    status: txn.status,
    amount: txn.amount,
    currency: txn.currency,
    merchantName: txn.merchantName,
    region: txn.region,
    createdAt: txn.createdAt,
    failureReason: txn.failureReason,
    ...overrides,
  };
}

export function generatePayment(overrides: Partial<Payment> = {}): Payment {
  const merchant = randomItem(MERCHANTS);
  const status: PaymentStatus = randomItem([
    'draft',
    'submitted',
    'processing',
    'succeeded',
    'failed',
  ]);

  return {
    id: generateId('pay'),
    idempotencyKey: `idem_${Date.now()}_${randomBetween(1000, 9999)}`,
    status,
    amount: randomBetween(1000, 5000000),
    currency: randomItem(CURRENCIES),
    intent: randomItem(['capture', 'authorize_only']),
    merchantId: merchant.id,
    merchantName: merchant.name,
    customerId: `cust_${randomBetween(1000, 9999)}`,
    description: randomItem([
      'Monthly subscription',
      'One-time purchase',
      'Service fee',
      'Product order #' + randomBetween(10000, 99999),
    ]),
    transactionIds: [],
    failureCode: status === 'failed' ? 'payment_failed' : null,
    failureMessage: status === 'failed' ? 'The payment could not be processed' : null,
    metadata: {},
    createdAt: new Date(Date.now() - randomBetween(0, 604800000)).toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: status === 'succeeded' ? new Date().toISOString() : null,
    ...overrides,
  };
}

export function generateDashboardMetrics(
  overrides: Partial<DashboardMetrics> = {}
): DashboardMetrics {
  const total = randomBetween(8000, 12000);
  const failed = randomBetween(100, 300);
  const successful = total - failed;

  return {
    timestamp: new Date().toISOString(),
    volume: {
      totalTransactions: total,
      successfulTransactions: successful,
      failedTransactions: failed,
      successRate: successful / total,
      volumeChange: (random() - 0.5) * 20, // -10% to +10%
    },
    latency: {
      p50Ms: randomBetween(80, 120),
      p95Ms: randomBetween(200, 350),
      p99Ms: randomBetween(400, 600),
      avgMs: randomBetween(100, 150),
    },
    throughput: {
      transactionsPerMinute: randomBetween(50, 150),
      peakTpm: randomBetween(180, 250),
      currentCapacityPercent: randomBetween(40, 75),
    },
    financial: {
      grossVolume: randomBetween(10000000, 50000000), // $100K - $500K
      netVolume: randomBetween(9500000, 48000000),
      currency: 'USD',
      refundRate: random() * 0.03, // 0-3%
      chargebackRate: random() * 0.01, // 0-1%
    },
    ...overrides,
  };
}

export function generateRegionalMetrics(): RegionalMetrics[] {
  return REGIONS.map((region) => ({
    region,
    regionName: {
      US: 'United States',
      EU: 'Europe',
      UK: 'United Kingdom',
      APAC: 'Asia Pacific',
      LATAM: 'Latin America',
      MEA: 'Middle East & Africa',
    }[region] || region,
    volume: randomBetween(500, 3000),
    successRate: 0.95 + random() * 0.04, // 95-99%
    avgLatencyMs: randomBetween(80, 300),
    status: randomItem(['healthy', 'healthy', 'healthy', 'degraded']) as
      | 'healthy'
      | 'degraded'
      | 'critical',
    incidents: randomItem([0, 0, 0, 1]),
  }));
}

export function generateIncident(overrides: Partial<Incident> = {}): Incident {
  const severity: IncidentSeverity = randomItem(['critical', 'high', 'medium', 'low']);
  const status: IncidentStatus = randomItem([
    'detected',
    'investigating',
    'identified',
    'mitigating',
  ]);

  return {
    id: generateId('inc'),
    title: randomItem([
      'Elevated error rate in EU region',
      'Payment processor latency spike',
      'Database connection pool exhaustion',
      'Third-party API timeout issues',
    ]),
    description:
      'Automated alert triggered due to metrics exceeding defined thresholds.',
    severity,
    status,
    category: randomItem(['availability', 'latency', 'error_rate']),
    affectedServices: ['payments-api', 'transaction-processor'],
    affectedRegions: [randomItem(REGIONS)],
    detectedAt: new Date(Date.now() - randomBetween(300000, 3600000)).toISOString(),
    acknowledgedAt:
      status !== 'detected'
        ? new Date(Date.now() - randomBetween(60000, 300000)).toISOString()
        : null,
    resolvedAt: null,
    assignee: randomItem([null, 'oncall-team', 'platform-eng']),
    timeline: [
      {
        id: '1',
        timestamp: new Date(Date.now() - randomBetween(300000, 3600000)).toISOString(),
        author: null,
        content: 'Incident automatically detected by monitoring system',
        type: 'status_change',
      },
    ],
    metrics: {
      impactedTransactions: randomBetween(50, 500),
      estimatedRevenueLoss: randomBetween(100000, 1000000),
      affectedMerchants: randomBetween(5, 50),
    },
    ...overrides,
  };
}

// Generate a batch of transactions for initial state
export function generateTransactionBatch(count: number): TransactionSummary[] {
  return Array.from({ length: count }, () => generateTransactionSummary());
}
