# Transaction API

Mongster provides a clean, intuitive transaction API with automatic session management and excellent developer experience.

## Features

- 🔄 **Automatic Session Management** - No need to manually pass sessions around
- ✨ **Clean Syntax** - Use `transaction.with(Model)` for automatic session injection
- 🛡️ **Auto Commit/Rollback** - Transactions automatically commit on success or rollback on error
- 🎯 **Type-Safe** - Full TypeScript support with proper type inference
- 🔌 **Compatible** - Works with all MongoDB transaction options

## Basic Usage

### Manual Session Passing

```typescript
import { mongster } from "mongster";

const result = await mongster.transaction(async (ctx) => {
  // Pass session manually to each operation
  const user = await User.createOne(
    { name: "Alice", email: "alice@example.com" },
    { session: ctx.session }
  );

  await Transaction.createOne(
    { userId: user._id, amount: 100, type: "credit" },
    { session: ctx.session }
  );

  return user;
});
```

### Automatic Session Injection (Recommended)

```typescript
const result = await mongster.transaction(async () => {
  // Get transaction-scoped models
  const TxUser = mongster.transaction.with(User);
  const TxTransaction = mongster.transaction.with(Transaction);

  // Session is automatically injected - no manual passing needed!
  const user = await TxUser.createOne({
    name: "Alice",
    email: "alice@example.com",
  });

  await TxTransaction.createOne({
    userId: user._id,
    amount: 100,
    type: "credit",
  });

  return user;
});
```

## Complete Example: Money Transfer

```typescript
import { M, mongster, model } from "mongster";

// Define schemas
const userSchema = M.schema({
  name: M.string(),
  email: M.string(),
  balance: M.number().default(0),
}).withTimestamps();

const transactionSchema = M.schema({
  userId: M.objectId(),
  amount: M.number(),
  type: M.string().enum(["debit", "credit"]),
  description: M.string(),
}).withTimestamps();

const User = model("users", userSchema);
const Transaction = model("transactions", transactionSchema);

// Connect to MongoDB (requires replica set for transactions)
await mongster.connect("mongodb://localhost:27017/mydb?replicaSet=rs0");

// Perform a money transfer in a transaction
async function transfer(fromEmail: string, toEmail: string, amount: number) {
  try {
    await mongster.transaction(async () => {
      const TxUser = mongster.transaction.with(User);
      const TxTransaction = mongster.transaction.with(Transaction);

      // Find users
      const fromUser = await TxUser.findOne({ email: fromEmail });
      const toUser = await TxUser.findOne({ email: toEmail });

      if (!fromUser || !toUser) {
        throw new Error("User not found");
      }

      if (fromUser.balance < amount) {
        throw new Error("Insufficient balance");
      }

      // Debit from sender
      await TxUser.updateOne(
        { _id: fromUser._id },
        { $inc: { balance: -amount } }
      );

      await TxTransaction.createOne({
        userId: fromUser._id,
        amount,
        type: "debit",
        description: `Transfer to ${toUser.name}`,
      });

      // Credit to receiver
      await TxUser.updateOne(
        { _id: toUser._id },
        { $inc: { balance: amount } }
      );

      await TxTransaction.createOne({
        userId: toUser._id,
        amount,
        type: "credit",
        description: `Transfer from ${fromUser.name}`,
      });

      console.log("Transfer successful!");
    });
  } catch (error) {
    console.error("Transfer failed:", error);
    // Transaction automatically rolled back
    throw error;
  }
}

// Use it
await transfer("alice@example.com", "bob@example.com", 50);
```

## Transaction Options

You can pass MongoDB transaction options as the second parameter:

```typescript
await mongster.transaction(
  async () => {
    const TxUser = mongster.transaction.with(User);
    // Your transaction logic
    return await TxUser.findOne({ email: "alice@example.com" });
  },
  {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
    maxCommitTimeMS: 5000,
  }
);
```

## Error Handling

Transactions automatically rollback on any error:

```typescript
try {
  await mongster.transaction(async () => {
    const TxUser = mongster.transaction.with(User);

    await TxUser.createOne({ name: "Alice", email: "alice@example.com" });

    // This error will trigger automatic rollback
    throw new Error("Something went wrong");
  });
} catch (error) {
  console.error("Transaction rolled back:", error);
  // No data was persisted
}
```

## Requirements

MongoDB transactions require:
- MongoDB 4.0+ (for replica sets)
- MongoDB 4.2+ (for sharded clusters)
- Connection to a replica set or sharded cluster

## API Reference

### `mongster.transaction<T>(callback, options?): Promise<T>`

Execute a transaction with automatic commit/rollback.

**Parameters:**
- `callback: (ctx: MongsterTransactionContext) => Promise<T>` - Transaction callback
- `options?: TransactionOptions` - MongoDB transaction options

**Returns:** `Promise<T>` - The value returned by the callback

### `mongster.transaction.with<M>(model): MongsterTransactionModel<M>`

Get a transaction-scoped version of a model with automatic session injection.

**Parameters:**
- `model: MongsterModel` - The model to wrap

**Returns:** `MongsterTransactionModel` - Transaction-scoped model

**Note:** Can only be called within a transaction callback.

### `MongsterTransactionContext`

```typescript
interface MongsterTransactionContext {
  session: ClientSession; // MongoDB client session
}
```

## Best Practices

1. **Use `transaction.with()` for cleaner code** - Avoid manually passing sessions
2. **Keep transactions short** - Long-running transactions can cause performance issues
3. **Handle errors appropriately** - Always wrap transactions in try-catch blocks
4. **Return meaningful values** - Return data you need from the transaction callback
5. **Avoid external API calls** - Don't make HTTP requests or other I/O inside transactions

## Examples

### Multi-Collection Operations

```typescript
await mongster.transaction(async () => {
  const TxUser = mongster.transaction.with(User);
  const TxOrder = mongster.transaction.with(Order);
  const TxInventory = mongster.transaction.with(Inventory);

  const user = await TxUser.findOne({ email: "customer@example.com" });
  if (!user) throw new Error("User not found");

  // Check inventory
  const item = await TxInventory.findOne({ sku: "WIDGET-001" });
  if (!item || item.quantity < 1) {
    throw new Error("Out of stock");
  }

  // Create order
  const order = await TxOrder.createOne({
    userId: user._id,
    items: [{ sku: "WIDGET-001", quantity: 1, price: 99.99 }],
    total: 99.99,
  });

  // Decrement inventory
  await TxInventory.updateOne(
    { sku: "WIDGET-001" },
    { $inc: { quantity: -1 } }
  );

  // Update user's order count
  await TxUser.updateOne(
    { _id: user._id },
    { $inc: { orderCount: 1 } }
  );

  return order;
});
```

### Conditional Logic in Transactions

```typescript
await mongster.transaction(async () => {
  const TxUser = mongster.transaction.with(User);

  const user = await TxUser.findOne({ email: "user@example.com" });

  if (user.balance >= 100) {
    // Deduct premium fee
    await TxUser.updateOne(
      { _id: user._id },
      { $inc: { balance: -100 }, $set: { isPremium: true } }
    );
  } else {
    // Set as free tier
    await TxUser.updateOne(
      { _id: user._id },
      { $set: { isPremium: false } }
    );
  }
});
```
