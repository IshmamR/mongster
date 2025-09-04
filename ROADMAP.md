# Roadmap

Short-term
- Wire `connect` and `Model` ops to official MongoDB driver behind an adapter.
- Expand `Filter<T>` to include regex, nested objects, and array operators.
- Add minimal tests with Bun test runner.
- Publish 0.1.0 once driver integration lands.

Medium-term
- Transactions & sessions helpers
- Aggregations builder
- Indexes and migrations helpers
- Hooks (before/after insert/update/delete)

Long-term
- Schema validation (opt-in) with Zod/Valibot codecs (no duplication)
- Better DX for projections and populations
- A good and complete in memory adapter to replicate mongodb for test purposes