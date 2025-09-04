# mongster

TypeScript‑first, chainable ODM for MongoDB. No decorators, no duplicate schema definitions — just strong types from your interfaces and a fluent API.

Status: pre‑alpha placeholder (v0.0.1). API will evolve quickly.

## Install

```bash
bun add mongster
```

Peer requirements:
- TypeScript ^5
- Bun >= 1.0 (for dev/build)

## Quick start

```ts
// types.ts
export interface User {
	email: string;
	name: string;
	age?: number;
}

// usage.ts
import { connect, model } from 'mongster';
import type { User } from './types';

await connect(process.env.MONGO_URI!);

const UserModel = model<User>('users');

// insert (strongly typed)
await UserModel.insert({ email: 'a@example.com', name: 'Alice' });

// chainable queries
const youngAlices = await UserModel
	.where({ name: 'Alice', age: { $lt: 30 } })
	.sort({ age: 'asc' })
	.limit(10)
	.find();
```

In v0.0.1 the DB operations are placeholders; they’ll be wired to the official MongoDB driver soon.

## Design principles

- TypeScript‑first: define domain types once with interfaces. No schema duplication.
- Fluent API: `model<T>()` returns a chainable query builder.
- Minimal runtime: thin layer over the official driver (planned).
- Opt‑in features: validation, hooks, and advanced filters land incrementally.

## API surface (preview)

- `connect(uri: string)` – set global connection context (placeholder).
- `model<T>(name: string)` – create a model bound to collection `name`.
- `Model<T>` methods:
	- `.find()` / `.findOne()` via `Query<T>`
	- `.where(filter)` returns `Query<T>`
	- `.insert(doc)` returns `{ insertedId, doc }`
	- `.update(filter, patch)` returns `{ matchedCount, modifiedCount }`
	- `.delete(filter)` returns `{ deletedCount }`

`Query<T>` chain:
- `.where(filter)` `.sort({ field: 'asc' | 'desc' | 1 | -1 })` `.project({ field: 1 })` `.limit(n)` `.skip(n)` `.find()` `.findOne()`

## Development

```bash
bun install
bun run typecheck
bun run build
```

Build outputs ESM to `dist/` with type declarations.

## License

MIT © IshmamR
