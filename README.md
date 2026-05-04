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
  Schema-first DX on top of official MongoDB driver. Keep MongoDB semantics. Add strong types, runtime validation, and automatic index metadata in one place.
</p>

> [!NOTE]
> Mongster is built for and with TypeScript for the modern AI era where types matter. 

## Jump To

- [Jump To](#jump-to)
- [Why Mongster](#why-mongster)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Features](#core-features)
- [Schema and Types](#schema-and-types)
  - [Type Inference](#type-inference)
  - [Index Automation](#index-automation)
- [Querying and Populate](#querying-and-populate)
- [Aggregation](#aggregation)
- [Hooks](#hooks)
- [Transactions](#transactions)
  - [Recommended: `ctx.use(Model)`](#recommended-ctxusemodel)
  - [Manual session passing](#manual-session-passing)
  - [Transaction options](#transaction-options)
- [Errors](#errors)
- [Connection Management](#connection-management)
- [API Overview](#api-overview)
  - [Top-level exports](#top-level-exports)
  - [Schema builder](#schema-builder)
  - [Model / transaction-scoped model](#model--transaction-scoped-model)
- [Limitations and Roadmap](#limitations-and-roadmap)
- [Contributing](#contributing)
- [License](#license)

## Why Mongster

- One schema drives runtime validation, TypeScript inference, and index metadata.
- <em>0 dependency</em>; Mongster is a small wrapper that works on the native Mongodb Nodejs driver. 
- Query builders stay close to MongoDB while adding typed projections, populate, and aggregation helpers.
- Transactions, hooks, and bulk operations work without switching to a separate API style.

## Installation

```bash
npm install mongodb mongster
# or
bun add mongodb mongster
# or
yarn add mongodb mongster
# or
pnpm add mongodb mongster
```

Requires Node >= 18. Should work with other runtimes such as deno and bun.

## Quick Start

```typescript
import { M, mongster } from "mongster";

const userSchema = M.schema({
  name: M.string().min(1),
  email: M.string().uniqueIndex(),
  age: M.number().min(0).max(120),
  gender: M.boolean(),
  socials: M.array(
    M.object({
      host: M.string(),
      link: M.string(),
    }),
  ).optional(),
}).withTimestamps();

type User = M.infer<typeof userSchema>;
type CreateUser = M.inferInput<typeof userSchema>;

const UserModel = mongster.model("users", userSchema);

await mongster.connect("mongodb://localhost:27017/mongster");

const created: User | null = await UserModel.createOne({
  name: "Alice",
  email: "alice@example.com",
  age: 25,
  socials: [{ host: "github", link: "https://github.com/alice" }],
});

const adults = await UserModel.find({ age: { $gte: 18 } })
  .include(["name", "email", "socials"])
  .sort({ age: -1 })
  .limit(10);

console.log(created, adults);
```

## Core Features

| Area | What you get |
| --- | --- |
| Schema | `M.schema()`, primitives, BSON types, arrays, objects, tuples, unions, defaults, runtime validation |
| Types | `M.infer`, `M.inferInput`, typed filters, typed updates, typed aggregation stages |
| Querying | `find`, `findOne`, `findById`, include/exclude, sort, skip, limit, distinct, count, etc. |
| "Relations" | `M.objectId().ref(() => Model)` plus typed populate on query builders |
| Runtime | hooks, transaction-scoped models, automatic index sync, structured errors |

## Schema and Types

```typescript
import { M } from "mongster";

const postSchema = M.schema({
  title: M.string().min(3),
  published: M.boolean().default(false),
  views: M.number().default(0),
  publishedAt: M.date().optional(),
  authorId: M.objectId(),
  price: M.decimal(),
  attachments: M.array(M.binary()).optional(),
  meta: M.object({
    category: M.string(),
    featured: M.boolean(),
  }),
});

type Post = M.infer<typeof postSchema>;
type PostInput = M.inferInput<typeof postSchema>;
```

### Type Inference

`M.infer<typeof schema>` gives you the type for how the document is stored in the DB.

`M.inferInput<typeof schema>` gives you the type for the create/update input shape.

### Index Automation

```typescript
const userSchema = M.schema({
  email: M.string().uniqueIndex(),
  username: M.string().index(1),
  lastLogin: M.date().index(-1),
  bio: M.string().textIndex(),
  hashKey: M.string().hashedIndex(),
  expiresAt: M.date().ttl(3600),
}).addIndex({ email: 1, username: 1 }, { unique: true });

await mongster.connect(uri, {
  autoIndex: { syncOnConnect: true },
});
```

Define indexes in schema metadata. Let Mongster sync them on connect or manually with `syncIndexes()`.

## Querying and Populate

> [!TIP]
> `find()`, `findOne()`, and `findById()` return thenable query builders. Awaiting the query executes it. So you can chain methods, and share query chains across your project easily before execution.

```typescript
const userQuery = User.find({ age: { $gte: 18 } });
const users = await userQuery
  .include(["name", "email"]) // type-safe btw, even works for nested paths
  .sort({ age: -1 })
  .skip(10)
  .limit(20);

const user = await User.findOne({ email: "alice@example.com" });
const byId = await User.findById(someObjectId);
```

Declare refs with `M.objectId().ref(() => Model)`, then populate them from queries.

```typescript
const authorSchema = M.schema({
  name: M.string(),
  social: M.object({
    github: M.string(),
  }),
});

const Author = mongster.model("authors", authorSchema);

const postSchema = M.schema({
  title: M.string(),
  category: M.string(),
  views: M.number(),
  published: M.boolean(),
  authorId: M.objectId().ref(() => Author),
});

const Post = mongster.model("posts", postSchema);

const posts = await Post.find({ published: true }).populate("authorId");
const selected = await Post.find({}).populate("authorId", {
  select: ["name", "social.github"],
  excludeId: true,
});
```

## Aggregation

```typescript
const report = await Post.aggregate()
  .match({ published: true })
  .group("$category",{
    totalViews: { $sum: "$views" },
    count: { $sum: 1 },
  })
  .sort({ totalViews: -1 })
  .exec();

const joined = await Post.aggregate()
  .lookup({
    from: Author,
    localField: "authorId",
    foreignField: "_id",
    as: "authors",
  })
  .unwind("$authors")
  .project({
    _id: 0,
    title: 1,
    authorName: "$authors.name",
  })
  .exec();
```

Use `aggregate.raw()` when you need a fully manual pipeline or when you want to opt out of stage inference for advanced expressions.

## Hooks

Hooks work at schema level and model level.

```typescript
const userSchema = M.schema({
  name: M.string(),
  email: M.string(),
});

userSchema.pre("createOne", (ctx) => {
  return {
    doc: {
      ...ctx.doc,
      email: ctx.doc.email.toLowerCase(),
    },
  };
});

userSchema.post("find", (ctx) => {
  console.log(`loaded ${ctx.result.length} users`);
});
```

> [!NOTE]
> Hook lifecycle are sequential:
> 
> model **(pre)** -> schema **(pre)** -> query -> schema **(post)** -> model **(post)** 

<details>
<summary>Supported hook operations</summary>

- `insertOne`, `insertMany`, `createOne`, `createMany`
- `find`, `findOne`, `findById`
- `updateOne`, `updateMany`, `findOneAndUpdate`, `replaceOne`, `findOneAndReplace`, `upsertOne`
- `deleteOne`, `deleteMany`, `findOneAndDelete`
- `bulkWrite`
- Group aliases: `save`, `modify`, `remove`

</details>

## Transactions

Mongster can wraps MongoDB transactions with automatic commit/rollback and transaction-scoped models via `ctx.use(Model)`.

> [!IMPORTANT]
> Transactions require a replica set or compatible sharded cluster.

### Recommended: `ctx.use(Model)`

```typescript
await mongster.transaction(async (ctx) => {
  const TxUser = ctx.use(User);
  const TxLog = ctx.use(Log);

  const user = await TxUser.createOne({
    name: "Alice",
    email: "alice@example.com",
  });

  await TxLog.createOne({
    userId: user?._id,
    action: "created",
  });

  const summary = await TxUser.aggregate()
    .match({ email: "alice@example.com" })
    .count("total");

  return summary;
});
```

### Manual session passing

```typescript
await mongster.transaction(async (ctx) => {
  await User.createOne(
    { name: "Bob", email: "bob@example.com" },
    { session: ctx.session },
  );
});
```

### Transaction options

```typescript
await mongster.transaction(
  async (ctx) => {
    const TxUser = ctx.use(User);
    return TxUser.findOne({ email: "alice@example.com" });
  },
  {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
    maxCommitTimeMS: 5000,
  },
);
```

If callback throws, Mongster aborts transaction and rethrows as `TransactionError`.

## Errors

Mongster uses different error type for different error cases. Current error types are:
- SchemaError
- ValidationError
- QueryError
- ConnectionError
- TransactionError
- IndexSyncError

```typescript
import { MongsterError, ValidationError } from "mongster";

try {
  await User.createOne({ age: 150 });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(error.message);
  }

  if (error instanceof MongsterError) {
    console.error(error.code, error.message);
  }
}
```

> [!NOTE]
> All the error types/classes are a sub-class of `MongsterError` 

## Connection Management

For multiple DB connections, use `MongsterClient`.

```typescript
import { MongsterClient } from "mongster";

const client = new MongsterClient();

await client.connect("mongodb://localhost:27017/mydb", {
  retryConnection: 3,
  retryDelayMs: 500,
  autoIndex: { syncOnConnect: true },
});

await client.ping();
await client.disconnect();
```

## API Overview

<details>
<summary>Exports and model surface</summary>

### Top-level exports

- `M`
- `mongster`
- `model`
- `MongsterClient`
- `MongsterError`, `ConnectionError`, `IndexSyncError`, `QueryError`, `SchemaError`, `TransactionError`, `ValidationError`

### Schema builder

- `M.string()`
- `M.number()`
- `M.boolean()`
- `M.date()`
- `M.objectId()`
- `M.decimal()`
- `M.binary()`
- `M.object(shape)`
- `M.array(schema)`
- `M.union(...schemas)` / `M.oneOf([...schemas])`
- `M.tuple([...schemas])` / `M.fixedArrayOf(...)`
- `M.schema(shape)`

### Model / transaction-scoped model

- create: `insertOne`, `insertMany`, `createOne`, `createMany`
- read: `find`, `findOne`, `findById`, `count`, `estimatedCount`, `distinct`
- update: `updateOne`, `updateMany`, `findOneAndUpdate`, `replaceOne`, `findOneAndReplace`, `upsertOne`
- delete: `deleteOne`, `deleteMany`, `findOneAndDelete`
- query extensions: `populate`, `aggregate`, `aggregateRaw`
- misc: `bulkWrite`, `syncIndexes`, `getCollection`, `getCollectionName`

</details>


## Limitations and Roadmap

- Populate currently supports top-level fields declared as `M.objectId().ref(() => Model)` only.
- Array refs are not populatable yet.
- `.ref()` is terminal for now. Do not chain `optional()`, `nullable()`, `default()`, or `defaultFn()` after it.
- Nested populate paths are not supported. Nested selection inside populated docs is supported.
- `findOne()` and `findById()` are query builders now. `await` still works, but they are not plain `Promise` values.
- Aggregation `.lookup()` currently accepts model instances only, not raw collection-name strings.
- Aggregation `.lookup()` always returns arrays. Use `.unwind()` when you need a single joined document shape.
- Aggregation type inference is strongest for field paths, literals, arrays, and nested object composition.
- Mongo expression operators inside `project()` / `addFields()` such as `$toUpper`, `$add`, `$cond`, and similar operators are not inferred yet. Use `raw<YourType>()` or an explicit generic escape hatch.
- Aggregation hooks do not exist yet.
- Transactions require replica set or sharded cluster support.
- A better documentation is being worked on.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Release process and maintainer workflow live there.

## License

MIT. See [LICENSE](LICENSE).