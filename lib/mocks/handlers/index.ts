/**
 * Combined MSW handlers.
 */

import { transactionHandlers } from './transactions';
import { metricsHandlers } from './metrics';
import { incidentHandlers } from './incidents';
import { sseStreamHandlers } from './sse-stream';
import { paymentHandlers } from './payments';
import { payoutHandlers } from './payouts';

export const handlers = [
  // SSE handlers must come BEFORE transaction handlers
  // because */api/transactions/:id would match /api/transactions/stream
  ...sseStreamHandlers,
  ...transactionHandlers,
  ...metricsHandlers,
  ...incidentHandlers,
  ...paymentHandlers,
  ...payoutHandlers,
];
