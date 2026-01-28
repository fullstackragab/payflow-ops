# PayFlow Ops — Production Payments Operations Dashboard

A **case study** demonstrating how a staff-level engineer approaches building internal financial systems. This is not a tutorial or feature demo — it's an architecture and reliability portfolio piece.

## What This System Demonstrates

| Capability | Implementation |
|------------|----------------|
| **Realtime data at scale** | SSE with backpressure, buffer caps, explicit drop counting |
| **Financial correctness** | Explicit state machines, idempotency keys, illegal transition prevention |
| **Settlement reality** | T+N delays, partial failures, manual reconciliation workflows |
| **Failure as first-class** | Every component handles loading, error, stale, and degraded states |
| **Operator trust** | Data freshness indicators, clear "no action required" vs "action required" |

**Target audience**: Finance teams monitoring transactions, operations teams tracking settlements, incident responders investigating failures.

## 5-Minute Demo Guide

```bash
npm install && npm run dev
# Open http://localhost:3000
```

**What to show:**

1. **Transactions** (`/transactions`) — Watch realtime events flow in. Pause the stream. Note the connection status indicator, dropped event counter, and backpressure warnings.

2. **Payments** (`/payments`) — Create a draft payment. Submit it. Use the simulation buttons to move it through states. Try an invalid transition — note the error explains *why* it's blocked.

3. **Payouts** (`/payouts`) — Find a batch marked "Needs Attention". Open the detail page. Note the T+N timeline, the settlement countdown, and the reconciliation workflow that requires notes.

4. **Chaos mode** — Press `Ctrl+Shift+D` to open the debug panel. Enable "Intermittent Failures" and watch the dashboard degrade gracefully.

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Next.js App Router                          │
├─────────────────────────────────────────────────────────────────────┤
│  Pages          │  Components       │  Hooks                        │
│  /transactions  │  StreamStatus     │  useSSE (reconnection)        │
│  /payments      │  LifecycleDiagram │  useBackpressureBuffer        │
│  /payments/[id] │  TransitionActions│  usePayments (TanStack Query) │
│  /payouts       │  SettlementTimeline│ usePayouts                   │
│  /payouts/[id]  │  PayoutStatusBadge │                              │
├─────────────────────────────────────────────────────────────────────┤
│                      State Machines & Utilities                     │
│  payment-lifecycle.ts  │  idempotency.ts  │  payout types           │
├─────────────────────────────────────────────────────────────────────┤
│                        MSW Mock Layer                               │
│  Chaos injection  │  Realistic latency  │  Failure simulation       │
└─────────────────────────────────────────────────────────────────────┘
```

**Tech stack**: Next.js 16, TypeScript (strict), TanStack Query, Tailwind CSS, MSW, Radix primitives.

**Why these choices**: Server/client component boundaries for data fetching. TanStack Query for cache management without Redux complexity. MSW for network-level mocking that exercises real error paths. No WebSocket — SSE is simpler and auto-reconnects.

## Failure Philosophy

Every component in this system assumes failure is normal:

| Failure Type | System Behavior |
|--------------|-----------------|
| API timeout | Show error, offer retry, display last-known data |
| SSE disconnect | Exponential backoff reconnect, show connection status |
| Event burst | Buffer with hard cap (50), drop oldest, count drops in UI |
| Partial outage | Degrade gracefully, show available data, hide broken sections |
| Network offline | Banner notification, queue retries on reconnect |

**Key insight**: A frozen UI is worse than a lossy one. Operators trust "5 events dropped" more than an unresponsive spinner.

## Financial Correctness Patterns

### State Machines (Payments)

Every payment transition is enumerated. If it's not in the map, it's illegal.

```typescript
// Only these transitions are allowed
const PAYMENT_TRANSITIONS = {
  draft: ['submitted', 'canceled'],
  submitted: ['processing', 'failed', 'canceled'],
  processing: ['requires_action', 'succeeded', 'failed'],
  // ...
};
```

The UI disables invalid actions and explains *why* transitions are blocked.

### Idempotency (Payment Creation)

```typescript
// Client generates key BEFORE request
const idempotencyKey = generateIdempotencyKey();

// Server contract:
// Same key + same request = return original result
// Same key + different request = 422 Conflict
```

This prevents double-charges when networks fail and clients retry.

### Settlement Reality (Payouts)

- **T+N settlement**: Funds take N business days. A T+2 payout on Monday settles Wednesday.
- **Partial failures**: Some items in a batch can fail while others succeed.
- **Reconciliation**: When state is unclear, operators must verify with the bank before marking resolved. No auto-retry.

## Intentional Omissions

This is a case study, not a production system. Explicitly out of scope:

- **Auth/RBAC** — Would add complexity without demonstrating new patterns
- **Database** — MSW mocks are sufficient for architecture demonstration
- **Charts/analytics** — Visual polish dilutes the reliability signal
- **AI features** — Adds noise, not hiring signal

These are not forgotten — they're excluded to maintain focus.

## Tradeoffs Made

| Decision | Why |
|----------|-----|
| SSE over WebSocket | Simpler, auto-reconnect, sufficient for this use case |
| Manual state machines over XState | Explicit transitions, no runtime dependency, easier to audit |
| TanStack Query over Redux | Server state only, no global store sync bugs |
| In-memory mocks over real DB | Faster iteration, chaos injection, no infrastructure |
| No optimistic updates | Financial data requires server confirmation |

## What Would Break at Scale

| Component | Breaking Point | Mitigation |
|-----------|---------------|------------|
| SSE connections | ~1000 per server | Redis pub/sub fan-out |
| Browser cache | ~50MB limit | Server-side pagination, cache eviction |
| Metrics queries | High cardinality | Pre-aggregation, time-series DB |

This system is designed for correctness, not scale. Scaling is an infrastructure problem, not an architecture problem.

## Development

```bash
npm install
npm run dev          # Development server
npx tsc --noEmit     # Type checking
npm run build        # Production build
```

Chaos controls: `Ctrl+Shift+D` opens the debug panel for failure injection.

---

Built with Next.js, TypeScript, and attention to operational reality.
