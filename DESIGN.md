# DESIGN: mongster

## Goals

- TypeScript-first: model your data with interfaces; keep runtime thin.
- Fluent chains: readable, composable query building.
- No decorators, no schema duplication.
- Interop with official MongoDB Node driver (planned).

## Non-goals (for now)

- Mongoose-level magic or heavy plugin system
- Runtime validation by default (can be added optionally later)

## Core concepts

- `model<T>(name) -> Model<T>`: binds an interface to a collection name.
- `Query<T>`: immutable-ish builder with chain methods that return `this`.
- Filters & conditions: strongly typed per field; start small, expand safely.

## Type safety approach

- Users define `interface User { ... }` and pass it to `model<User>(...)`.
- `Filter<User>` constrains comparisons per property type.
- Projection/sort infer keys from `T` to avoid typos.

## Execution model

- v0 (placeholder): methods return empty results; no side-effects.
- v1: add an adapter over the official driver. Keep the surface stable.
- Future: support transactions, indexes, aggregation, and hooks.
