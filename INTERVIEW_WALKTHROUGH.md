# Interview Walkthrough Script

*2-3 minute verbal walkthrough. Read through once, then practice until it sounds natural.*

---

## Opening (15 seconds)

"This is a payments operations dashboard I built as a case study. It's not about features — it's about handling the hard parts of financial systems: realtime data that can overwhelm you, state machines that prevent illegal operations, and settlement delays that mean money doesn't move instantly."

## Realtime Risk (45 seconds)

"The transactions page shows a live event stream. The interesting part isn't that it updates — it's what happens when events come faster than the UI can handle.

I built explicit backpressure. There's a buffer with a hard cap. When it fills up, we drop the oldest events and show a counter: '12 events dropped.' That sounds bad, but it's actually safer than the alternatives. You could buffer forever and run out of memory. You could freeze the UI waiting for the buffer to drain. Both of those break operator trust.

Dropping events and being transparent about it keeps the system responsive and keeps operators informed. They know something happened and can investigate if needed."

## Money Correctness (45 seconds)

"Payments go through a lifecycle — draft, submitted, processing, succeeded, failed. Every valid transition is explicitly listed in a state machine. If it's not in the map, it's illegal.

The UI doesn't just disable buttons — it explains why. 'Cannot refund: payment not yet captured.' This matters because operators make decisions under pressure. They need to know what they can do and why.

For payment creation, I use client-generated idempotency keys. The client creates the key before sending the request. If the response is lost and they retry, the server returns the original result instead of creating a duplicate. That's how you prevent double-charges."

## Settlement Reality (45 seconds)

"Payouts show the part most demos skip: money doesn't move instantly. A T+2 payout processed Monday settles Wednesday. The UI shows a countdown and explains that expected dates are estimates, not guarantees.

Batches can partially fail — some items settle, others don't. The UI separates these clearly.

The key decision: there's no auto-retry. If a payout fails or times out, we don't know if it actually went through at the bank. Retrying could mean paying the merchant twice. Instead, the system requires manual reconciliation — verify with the bank, record your findings, then mark it resolved. It's high-friction by design because correctness matters more than convenience."

## Closing (15 seconds)

"The whole thing is designed around operator trust. Show connection status. Count dropped events. Explain why actions are blocked. Make settlement timing visible. When something goes wrong, the operator should understand what happened and what they can do about it."

---

## If Asked Follow-Up Questions

**"Why not WebSocket?"**
"SSE is simpler and auto-reconnects out of the box. WebSocket would work, but for a unidirectional stream, SSE is the right tool."

**"Why not Redux?"**
"TanStack Query handles server state with caching and background refresh. Adding a client store creates sync problems without benefit for this use case."

**"How would this scale?"**
"The architecture is sound. SSE would need fan-out via Redis pub/sub. Browser cache would need eviction policies. But those are infrastructure problems, not design problems. The patterns stay the same."

**"What's missing?"**
"Auth, persistence, observability. Those are intentionally out of scope. This is a case study showing how I think about reliability and correctness, not a production system."
