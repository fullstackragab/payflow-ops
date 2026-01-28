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
  ...transactionHandlers,
  ...metricsHandlers,
  ...incidentHandlers,
  ...sseStreamHandlers,
  ...paymentHandlers,
  ...payoutHandlers,
];
