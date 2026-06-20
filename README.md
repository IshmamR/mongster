<p align="center">
  <img src="https://raw.githubusercontent.com/IshmamR/mongster/main/assets/mongster.svg" alt="Mongster logo" width="120" />
</p>

<h1 align="center">Mongster</h1>

<p align="center">
  Type-safe MongoDB ODM and Schema validator for TypeScript with hooks, typed populate, transactions, and <em>typed aggregation</em> builder.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/mongster"><img src="https://img.shields.io/npm/v/mongster?color=23d4bc&label=npm" alt="npm version" /></a>
  <a href="https://github.com/IshmamR/mongster/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/IshmamR/mongster/ci.yml?branch=main&label=CI" alt="CI status" /></a>
  <a href="https://github.com/IshmamR/mongster/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/mongster" alt="License" /></a>
  <a href="https://github.com/IshmamR/mongster/blob/main/package.json"><img src="https://img.shields.io/badge/node-%3E%3D18-339933" alt="Node >= 18" /></a>
</p>

<p align="center">
  <a href="https://mongster.ishmam.dev"><strong>📚 Full documentation → mongster.ishmam.dev</strong></a>
</p>

Schema-first DX on top of the official MongoDB driver. Keep MongoDB semantics. Add strong types, runtime validation, and automatic index metadata in one place.

> [!NOTE]
> Mongster is built for and with TypeScript for the modern AI era where types matter.

## Install

```bash
npm install mongodb mongster
# or
bun add mongodb mongster
# or
yarn add mongodb mongster
# or
pnpm add mongodb mongster
```

Requires Node >= 18. Works on Bun, Deno, and other Node-compatible runtimes.

## Features

- **Typed aggregation** — `Post.aggregate().match().group().sort().exec()` infers the result shape from each stage
- **End-to-end type safety** — schemas, inputs, filters, updates, and aggregation stages all flow into one inferred type
- **Typed populate** — declare `M.objectId().ref(() => Model)` once and get type-checked populate with nested projection
- **Single schema declaration** — one `M.schema(...)` drives runtime validation, TypeScript inference, and index metadata
- **Official MongoDB driver core** — thin wrapper over the official driver, no custom query engine or hidden abstractions


## Quick Start

```typescript
import { M, mongster } from "mongster";

const userSchema = M.schema({
  name: M.string().min(1),
  email: M.string().uniqueIndex(),
  age: M.number().min(0).max(120),
  socials: M.array(
    M.object({ host: M.string(), link: M.string() }),
  ).optional(),
}).withTimestamps();

type User = M.infer<typeof userSchema>;
type CreateUser = M.inferInput<typeof userSchema>;

const UserModel = mongster.model("users", userSchema);

await mongster.connect("mongodb://localhost:27017/mongster");

const created = await UserModel.createOne({
  name: "Alice",
  email: "alice@example.com",
  age: 25,
  socials: [{ host: "github", link: "https://github.com/alice" }],
});

const adults = await UserModel.find({ age: { $gte: 18 } })
  .include(["name", "email", "socials"])
  .sort({ age: -1 })
  .limit(10);
```

## Documentation

Guides, API reference, and examples live at **[mongster.ishmam.dev](https://mongster.ishmam.dev)**.

- [Getting started](https://mongster.ishmam.dev/docs/getting-started/quick-start)
- [Schema & types](https://mongster.ishmam.dev/docs/guides/schema)
- [Querying](https://mongster.ishmam.dev/docs/guides/querying)
- [Populate](https://mongster.ishmam.dev/docs/guides/populate)
- [Aggregation](https://mongster.ishmam.dev/docs/guides/aggregation)
- [Hooks](https://mongster.ishmam.dev/docs/guides/hooks)
- [Transactions](https://mongster.ishmam.dev/docs/guides/transactions)
- [Errors](https://mongster.ishmam.dev/docs/api/errors)
- [API reference](https://mongster.ishmam.dev/docs/api)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Release process and maintainer workflow live there.

## License

MIT. See [LICENSE](LICENSE).
