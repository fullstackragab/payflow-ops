# Case Study: PayFlow Ops

## The Problem

Internal tools for financial operations are often built as CRUD apps with a React frontend. They work in demos but fail in production because they don't account for:

- **Network unreliability** — APIs timeout, connections drop, retries happen
- **Financial correctness** — Duplicate requests can create duplicate charges
- **Operational reality** — Money doesn't move instantly; settlement takes days

I built PayFlow Ops to demonstrate how I approach these problems.

## What I Built

A payments operations dashboard handling three core flows:

1. **Realtime transaction monitoring** — A live stream of payment events with backpressure handling. When events arrive faster than the UI can render, the system drops oldest events and tells the operator exactly how many were dropped. This is safer than freezing or buffering infinitely.

2. **Payment lifecycle management** — Payments move through states (draft → submitted → processing → succeeded). Every valid transition is explicitly enumerated in a state machine. Invalid transitions are blocked with explanations. Duplicate requests return the original result via idempotency keys.

3. **Payout settlement tracking** — Payouts don't settle instantly. A T+2 batch processed Monday arrives Wednesday. The UI shows settlement countdowns, handles partial failures (some items succeed, others fail), and requires manual reconciliation when state is unclear. No auto-retry — that risks double-payment.

## Key Design Decisions

**Explicit state machines over implicit status fields.** If a transition isn't in the map, it's illegal. The UI can't accidentally allow an invalid action because the validation is centralized.

**Client-generated idempotency keys.** The client creates the key before the first request. If the server generated keys, a lost response would mean a lost key and potential duplicate on retry.

**Backpressure with drop counting.** When events burst, we drop the oldest and increment a counter visible in the UI. Operators trust "47 events dropped" more than a frozen screen or an "Out of memory" crash.

**Reconciliation over auto-retry.** A failed payout may have partially succeeded at the bank. Blind retry could double-pay the merchant. The system forces operators to verify with the bank and record their findings before resolving.

## Technical Choices

- **Next.js App Router** — Server/client component boundaries, built-in routing
- **TanStack Query** — Server state caching without Redux sync problems
- **SSE over WebSocket** — Simpler, auto-reconnects, sufficient for this use case
- **MSW mocking** — Network-level mocks that exercise real error paths, with chaos injection for failure simulation

## What I Intentionally Didn't Build

- **Auth/RBAC** — Adds complexity without demonstrating new patterns
- **Charts/dashboards** — Visual polish dilutes the reliability signal
- **AI features** — Noise, not signal
- **Database persistence** — MSW mocks are sufficient for architecture demonstration

These aren't forgotten — they're excluded to keep focus on the hard problems.

## The Hiring Signal

This project shows:

- I understand that failure is the default state, not an edge case
- I can design systems where correctness matters more than features
- I think about operators, not just users
- I know when to stop building and start documenting trade-offs

The code is at [https://github.com/fullstackragab/payflow-ops](https://github.com/fullstackragab/payflow-ops). The demo takes 5 minutes. The architecture is explained in the README.

---

_Built as a staff-level engineering portfolio piece. Not production code — a demonstration of how I think about systems._
