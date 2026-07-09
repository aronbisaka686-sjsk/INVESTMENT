---
name: Profit credit concurrency
description: How profit crediting avoids double-credit races and fractional-day loss
---

## The rule
`creditOneInvestment` uses optimistic concurrency control on `last_credited_at`.

**Optimistic lock:** The investment row is updated with `WHERE last_credited_at = <read_value>` (or `IS NULL`). If a concurrent request already advanced the value, the update returns 0 rows and the function returns `null` without crediting. This prevents duplicate balance increases and duplicate `user_transactions` rows.

**Fractional-day carryover:** `last_credited_at` is set to `creditBase + daysElapsed × 24h`, NOT to `now()`. This preserves the fractional remainder (e.g. 0.8 of a day) for the next credit run instead of discarding it, preventing systematic under-crediting.

**Why:** Without the optimistic lock, two simultaneous `/profit/credit` calls both read the same stale snapshot, compute the same days, and both commit — doubling the credit. Without exact day advancement, fractional time is silently dropped on every run.

**How to apply:** Any future change to profit crediting must maintain both invariants. If switching to pessimistic locking (`SELECT … FOR UPDATE`), the WHERE clause condition can be removed, but the exact-day advancement must stay.
