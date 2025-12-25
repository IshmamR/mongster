import { M, model, mongster } from "../src/index";

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

// Create models
const User = model("users", userSchema);
const Transaction = model("transactions", transactionSchema);

async function main() {
  await mongster.connect("mongodb://localhost:27017/mongster-example");

  // Example 1: Simple transaction with automatic commit/rollback
  try {
    const result = await mongster.transaction(async (ctx) => {
      // Create a user within the transaction
      const user = await User.createOne(
        {
          name: "Alice",
          email: "alice@example.com",
        },
        { session: ctx.session },
      );

      if (!user) return null;

      // Create a transaction record
      await Transaction.createOne(
        {
          userId: user._id,
          amount: 100,
          type: "credit",
          description: "Initial deposit",
        },
        { session: ctx.session },
      );

      // Update user balance
      await User.updateOne({ _id: user._id }, { $inc: { balance: 100 } }, { session: ctx.session });

      return user;
    });

    console.log("Transaction completed:", result);
  } catch (error) {
    console.error("Transaction failed:", error);
    // Transaction automatically rolled back
  }

  // Example 2: Using ctx.with() for cleaner syntax
  try {
    const result = await mongster.transaction(async (ctx) => {
      // Get transaction-scoped models that automatically use the session
      const TxUser = ctx.with(User);
      const TxTransaction = ctx.with(Transaction);

      // No need to pass session manually - it's automatic!
      const user = await TxUser.createOne({
        name: "Bob",
        email: "bob@example.com",
      });

      await TxTransaction.createOne({
        userId: user._id,
        amount: 250,
        type: "credit",
        description: "Bonus credit",
      });

      await TxUser.updateOne({ _id: user._id }, { $inc: { balance: 250 } });

      return { user, success: true };
    });

    console.log("Transaction with .with() completed:", result);
  } catch (error) {
    console.error("Transaction failed:", error);
  }

  // Example 3: Transfer between users (classic transaction use case)
  try {
    await mongster.transaction(async (ctx) => {
      const TxUser = ctx.with(User);
      const TxTransaction = ctx.with(Transaction);

      const fromUser = await TxUser.findOne({ email: "alice@example.com" });
      const toUser = await TxUser.findOne({ email: "bob@example.com" });

      if (!fromUser || !toUser) {
        throw new Error("Users not found");
      }

      if (fromUser.balance < 50) {
        throw new Error("Insufficient balance");
      }

      // Debit from sender
      await TxUser.updateOne({ _id: fromUser._id }, { $inc: { balance: -50 } });

      await TxTransaction.createOne({
        userId: fromUser._id,
        amount: 50,
        type: "debit",
        description: "Transfer to Bob",
      });

      // Credit to receiver
      await TxUser.updateOne({ _id: toUser._id }, { $inc: { balance: 50 } });

      await TxTransaction.createOne({
        userId: toUser._id,
        amount: 50,
        type: "credit",
        description: "Transfer from Alice",
      });

      console.log("Transfer completed successfully");
    });
  } catch (error) {
    console.error("Transfer failed:", error);
  }

  // Example 4: Transaction with custom options
  await mongster.transaction(
    async (ctx) => {
      const TxUser = ctx.with(User);
      // Your transaction logic here
      return await TxUser.count();
    },
    {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      maxCommitTimeMS: 5000,
    },
  );

  await mongster.disconnect();
}

main().catch(console.error);
