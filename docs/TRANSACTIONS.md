# Transactions

Mongster wraps MongoDB transactions with automatic commit / rollback and transaction-scoped models.

## Current API

Use `mongster.transaction(async (ctx) => { ... })`.

Examples below assume `User`, `Log`, and `Post` models are already defined.

Inside the callback you get:

- `ctx.session` for manual session passing
- `ctx.use(Model)` for a transaction-scoped model with automatic session injection

## Basic Usage

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
});
```

### Manual session passing

```typescript
await mongster.transaction(async (ctx) => {
  const user = await User.createOne(
    { name: "Alice", email: "alice@example.com" },
    { session: ctx.session },
  );

  await Log.createOne(
    { userId: user?._id, action: "created" },
    { session: ctx.session },
  );
});
```

## What Works in Transaction-Scoped Models

Transaction-scoped models currently support:

- `insertOne`, `insertMany`, `createOne`, `createMany`
- `find`, `findOne`, `findById`
- `updateOne`, `updateMany`, `findOneAndUpdate`
- `replaceOne`, `findOneAndReplace`, `upsertOne`
- `deleteOne`, `deleteMany`, `findOneAndDelete`
- `count`, `distinct`
- `aggregate`, `aggregateRaw`
- `bulkWrite`

Query builders still work inside transactions:

```typescript
await mongster.transaction(async (ctx) => {
  const TxPost = ctx.use(Post);

  const posts = await TxPost.find({ published: true }).populate("authorId");

  const summary = await TxPost.aggregate()
    .match({ published: true })
    .group({ _id: "$category", total: { $sum: 1 } })
    .exec();

  return { posts, summary };
});
```

## Transaction Options

Pass MongoDB transaction options as the second argument:

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

## Error Handling

Any error thrown inside the callback aborts the transaction.

```typescript
try {
  await mongster.transaction(async (ctx) => {
    const TxUser = ctx.use(User);

    await TxUser.createOne({ name: "Alice", email: "alice@example.com" });

    throw new Error("boom");
  });
} catch (error) {
  console.error("transaction rolled back", error);
}
```

Mongster rethrows transaction failures as `TransactionError`.

## Caveats

- transactions require a replica set or compatible sharded cluster
- keep transactions short; avoid long waits or external network calls inside them
- `ctx.use(Model)` is callback-scoped; do not hold transaction-scoped models after the callback resolves
- aggregate hooks do not exist yet, including inside transactions
- populate limitations still apply inside transactions: top-level ref fields only, no array-ref populate

## Requirements

- MongoDB 4.0+ for replica-set transactions
- MongoDB 4.2+ for sharded-cluster transactions
- connection string that targets a topology with transaction support