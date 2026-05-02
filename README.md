# Mongster

A type-safe MongoDB ODM for TypeScript with schema validation, automatic index sync, hooks, populate, transactions, and a fluent aggregation builder.

## Current State

Current main-branch capabilities:

- fully typed schema input/output inference
- runtime validation for create/update flows
- automatic index sync from schema metadata
- CRUD model API with typed filters and updates
- fluent find builder with `include`, `exclude`, `sort`, `skip`, `limit`
- populate for root-level ref fields
- pre/post hooks for save, modify, remove, find, and `bulkWrite`
- transaction-scoped models via `ctx.use(Model)`
- type-safe aggregation builder with `group`, `lookup`, `unwind`, `project`, `addFields`, `count`, `raw`, and `explain`

## Releasing

Releases are manual. See [docs/RELEASING.md](docs/RELEASING.md).

## Installation

```bash
npm install mongster
# or
bun add mongster
# or
yarn add mongster
# or
pnpm add mongster
```

Examples below are independent unless noted otherwise.

## Quick Start

```typescript
import { M, mongster } from "mongster";

const userSchema = M.schema({
  name: M.string(),
  email: M.string(),
  age: M.number().min(0).max(120),
  tags: M.array(M.string()).optional(),
}).withTimestamps();

const User = mongster.model("users", userSchema);

await mongster.connect("mongodb://localhost:27017/mydb");

const created = await User.createOne({
  name: "Alice",
  email: "alice@example.com",
  age: 25,
});

const users = await User.find({ age: { $gte: 18 } })
  .include(["name", "email"])
  .sort({ age: -1 })
  .limit(10);
```

## Schema Basics

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
```

### Type Inference

```typescript
import { M } from "mongster";

const userSchema = M.schema({
  name: M.string(),
  age: M.number(),
});

type User = M.infer<typeof userSchema>;
type UserInput = M.inferInput<typeof userSchema>;
```

### Indexes

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

## Querying

### Find Builder

`find()`, `findOne()`, and `findById()` return thenable builders. You can `await` them directly, or chain before execution.

```typescript
const users = await User.find({ age: { $gte: 18 } })
  .include(["name", "email"])
  .sort({ age: -1 })
  .skip(10)
  .limit(20);

const user = await User.findOne({ email: "alice@example.com" });
const byId = await User.findById(someObjectId);
```

### Populate

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

const posts = await Post.find({}).populate("authorId");
const selected = await Post.find({}).populate("authorId", {
  select: ["name", "social.github"] as const,
  excludeId: true,
});
```

### Aggregation Builder

```typescript
const report = await Post.aggregate()
  .match({ published: true })
  .group({
    _id: "$category",
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
  .unwind("authors")
  .project({
    _id: 0,
    title: 1,
    authorName: "$authors.name",
  })
  .exec();
```

Use `aggregateRaw()` when you need a fully manual pipeline.

## CRUD API

### Create

```typescript
await User.insertOne({ name: "Alice", email: "alice@example.com", age: 25 });
await User.insertMany([
  { name: "A", email: "a@example.com", age: 20 },
  { name: "B", email: "b@example.com", age: 22 },
]);

const created = await User.createOne({ name: "Bob", email: "bob@example.com", age: 30 });
const createdMany = await User.createMany([
  { name: "C", email: "c@example.com", age: 28 },
  { name: "D", email: "d@example.com", age: 31 },
]);
```

### Read

```typescript
await User.find({ age: { $gte: 18 } });
await User.findOne({ email: "alice@example.com" });
await User.findById(id);
await User.count({ age: { $gte: 18 } });
await User.estimatedCount();
await User.distinct("email");
```

### Update / Delete

```typescript
await User.updateOne({ email: "alice@example.com" }, { $set: { age: 26 } });
await User.updateMany({ age: { $lt: 18 } }, { $set: { age: 18 } });
await User.replaceOne({ _id: id }, {
  name: "Alice",
  email: "alice@example.com",
  age: 26,
  tags: ["verified"],
});
await User.upsertOne(
  { email: "new@example.com" },
  { name: "New User", email: "new@example.com", age: 21 },
);

await User.deleteOne({ email: "alice@example.com" });
await User.deleteMany({ age: { $lt: 0 } });
```

### Bulk Write

```typescript
await User.bulkWrite([
  { insertOne: { document: { name: "Alice", email: "alice@example.com", age: 25 } } },
  {
    updateOne: {
      filter: { email: "alice@example.com" },
      update: { $set: { age: 30 } },
    },
  },
]);
```

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

Supported hook operations currently include:

- `insertOne`, `insertMany`, `createOne`, `createMany`
- `find`, `findOne`, `findById`
- `updateOne`, `updateMany`, `findOneAndUpdate`, `replaceOne`, `findOneAndReplace`, `upsertOne`
- `deleteOne`, `deleteMany`, `findOneAndDelete`
- `bulkWrite`

Group aliases:

- `save`
- `modify`
- `remove`

## Transactions

Mongster transactions use `ctx.use(Model)` for automatic session injection.

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

  const summary = await TxUser.aggregate().match({ email: "alice@example.com" }).count("total");
  return summary;
});
```

Manual session passing is still available:

```typescript
await mongster.transaction(async (ctx) => {
  await User.createOne({ name: "Bob", email: "bob@example.com" }, { session: ctx.session });
});
```

See [docs/TRANSACTIONS.md](docs/TRANSACTIONS.md) for details.

## Errors

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

## Connection Management

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

## Current Caveats / Shortcomings

- populate works only on top-level fields declared as `M.objectId().ref(() => Model)`
- populate does not support arrays of refs yet
- `.ref()` is terminal for now; do not chain `optional()`, `nullable()`, `default()`, or `defaultFn()` after it
- nested populate paths are not supported; nested selection inside populated docs is supported
- `findOne()` and `findById()` are query builders now; `await` still works, but they are not plain `Promise` values
- aggregation `.lookup()` currently accepts model instances only, not raw collection-name strings
- aggregation `.lookup()` always returns arrays; use `.unwind()` when you need a single joined document shape
- aggregation type inference is best for field paths, literals, arrays, and nested object composition
- Mongo expression operators inside `project()` / `addFields()` such as `$toUpper`, `$add`, `$cond`, etc. are not inferred yet; use `raw<YourType>()` or a manual generic escape hatch
- aggregation hooks do not exist yet
- transactions require a replica set or sharded cluster that supports transactions

## API Surface

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).