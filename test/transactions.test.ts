import { afterAll, beforeAll, describe, expect, expectTypeOf, test } from "bun:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { TransactionError } from "../src/error";
import { M, MongsterClient } from "../src/index";
import type { InferSchemaType } from "../src/types/types.schema";

let mongod: MongoMemoryReplSet | null = null;
let client: MongsterClient;

const userSchema = M.schema({
  name: M.string(),
  email: M.string(),
  balance: M.number().default(0),
});

const logSchema = M.schema({
  userId: M.objectId(),
  action: M.string(),
  amount: M.number().optional(),
});

describe("Transaction API", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 2 } });

    client = new MongsterClient();
    const uri = mongod.getUri();
    await client.connect(uri);
  }, 10000);

  afterAll(async () => {
    await client.disconnect();
    await mongod?.stop();
  });

  test("should commit transaction when successful", async () => {
    const User = client.model("users_commit", userSchema);

    const result = await client.transaction(async (ctx) => {
      const user = await User.createOne(
        { name: "Alice", email: "alice@test.com" },
        { session: ctx.session },
      );

      await User.updateOne(
        { _id: user?._id },
        { $set: { balance: 100 } },
        { session: ctx.session },
      );

      return user;
    });

    expectTypeOf<InferSchemaType<typeof userSchema> | null>(result);
    expect(result).toBeDefined();
    expect(result?.name).toBe("Alice");

    const user = await User.findOne({ email: "alice@test.com" });
    expect(user?.balance).toBe(100);
  });

  test("should rollback transaction on error", async () => {
    const User = client.model("users_rollback", userSchema);

    const { insertedId: user1Id } = await User.insertOne({
      name: "Alice",
      email: "alice@trans.gender",
    });

    try {
      await client.transaction(async (ctx) => {
        await User.updateOne(
          { _id: user1Id },
          { $set: { email: "alice@ungabunga.gg" } },
          { session: ctx.session },
        );

        await User.createOne({ name: "Bob", email: "bob@test.com" }, { session: ctx.session });

        throw Error("Simulated error");
      });
    } catch (error: any) {
      expect(error.message).toContain("Simulated error");
    }

    const user1 = await User.findOne({ _id: user1Id });
    expect(user1?.email).toBe("alice@trans.gender");

    const user2 = await User.findOne({ email: "bob@test.com" });
    expect(user2).toBeNull();
  });

  test("should work with ctx.use() for automatic session injection", async () => {
    const User = client.model("users_with", userSchema);
    const Log = client.model("logs_with", logSchema);

    const result = await client.transaction(async (ctx) => {
      const ScopedUser = ctx.use(User);
      const ScopedLog = ctx.use(Log);

      const user = await ScopedUser.createOne({ name: "Charlie", email: "charlie@test.com" });

      if (!user) throw new Error("User creation failed");

      await ScopedLog.createOne({ userId: user._id, action: "created" });

      await ScopedUser.updateOne({ _id: user._id }, { $set: { balance: 50 } });

      return user;
    });

    expect(result).toBeDefined();
    expect(result?.name).toBe("Charlie");

    const user = await User.findOne({ email: "charlie@test.com" });
    expect(user?.balance).toBe(50);

    const logs = await Log.find({ userId: user?._id });
    expect(logs.length).toBe(1);
    expect(logs[0]?.action).toBe("created");
  });

  test("should handle complex multi-collection transactions", async () => {
    const User = client.model("users_complex", userSchema);
    const Log = client.model("logs_complex", logSchema);

    const alice = await User.createOne({ name: "Alice", email: "alice@complex.com", balance: 100 });

    const bob = await User.createOne({ name: "Bob", email: "bob@complex.com", balance: 50 });

    await client.transaction(async (ctx) => {
      const ScopedUser = ctx.use(User);
      const ScopedLog = ctx.use(Log);

      if (!alice || !bob) throw new Error("Users not found");

      await ScopedUser.updateOne({ _id: alice._id }, { $inc: { balance: -30 } });

      await ScopedLog.createOne({ userId: alice._id, action: "transfer_out", amount: 30 });

      await ScopedUser.updateOne({ _id: bob._id }, { $inc: { balance: 30 } });

      await ScopedLog.createOne({ userId: bob._id, action: "transfer_in", amount: 30 });
    });

    const aliceAfter = await User.findOne({ _id: alice?._id });
    const bobAfter = await User.findOne({ _id: bob?._id });

    expect(aliceAfter?.balance).toBe(70);
    expect(bobAfter?.balance).toBe(80);

    const aliceLogs = await Log.find({ userId: alice?._id });
    const bobLogs = await Log.find({ userId: bob?._id });

    expect(aliceLogs.length).toBe(1);
    expect(bobLogs.length).toBe(1);
  });

  test("should work with transaction options", async () => {
    const User = client.model("users_options", userSchema);

    const result = await client.transaction(
      async (ctx) => {
        const ScopedUser = ctx.use(User);
        const result = await ScopedUser.createOne({ name: "Dave", email: "dave@test.com" });
        return result;
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );

    expect(result).toBeDefined();
    expect(result?.name).toBe("Dave");

    const exists = await User.findOne({ name: "Dave" });
    expect(exists).not.toBeNull();
  });

  test("should handle nested operations correctly", async () => {
    const User = client.model("users_nested", userSchema);

    await client.transaction(async (ctx) => {
      const ScopedUser = ctx.use(User);

      const users = await ScopedUser.createMany([
        { name: "User1", email: "user1@test.com" },
        { name: "User2", email: "user2@test.com" },
        { name: "User3", email: "user3@test.com" },
      ]);

      expect(users.length).toBe(3);

      for (const user of users) {
        await ScopedUser.updateOne({ _id: user._id }, { $set: { balance: 25 } });
      }

      const count = await ScopedUser.count();
      expect(count).toBe(3);
    });

    const allUsers = await User.find();
    expect(allUsers.length).toBe(3);
    allUsers.forEach((user) => {
      expect(user.balance).toBe(25);
    });
  });

  test("should rollback all operations on error in middle of transaction", async () => {
    const User = client.model("users_partial_rollback", userSchema);

    try {
      await client.transaction(async (ctx) => {
        const ScopedUser = ctx.use(User);

        await ScopedUser.createOne({ name: "User1", email: "user1@partial.com" });
        await ScopedUser.createOne({ name: "User2", email: "user2@partial.com" });

        const userCount = await ScopedUser.count();
        expect(userCount).toBe(2);

        throw Error("Partial rollback test");
      });
    } catch (error: any) {
      expect(error.message).toBe("Partial rollback test");
    }

    const usersCount = await User.count();
    expect(usersCount).toBe(0);
  });

  test("should properly propagate error cause in transaction failures", async () => {
    const originalError = new Error("Original cause");
    originalError.cause = "Nested cause";

    try {
      await client.transaction(async () => {
        throw originalError;
      });
    } catch (error: any) {
      expect(error.message).toBe("Original cause");
      expect(error.cause).toBeDefined();
    }
  });

  test("should handle distinct and aggregateRaw operations in transactions", async () => {
    const User = client.model("users_distinct_agg", userSchema);

    await client.transaction(async (ctx) => {
      const ScopedUser = ctx.use(User);

      await ScopedUser.createMany([
        { name: "Alice", email: "alice@distinct.com", balance: 100 },
        { name: "Bob", email: "bob@distinct.com", balance: 200 },
        { name: "Alice", email: "alice2@distinct.com", balance: 150 },
      ]);

      const distinctNames = await ScopedUser.distinct("name");
      expect(distinctNames).toContain("Alice");
      expect(distinctNames).toContain("Bob");
      expect(distinctNames.length).toBe(2);

      const aggResult = await ScopedUser.aggregateRaw([
        { $group: { _id: "$name", totalBalance: { $sum: "$balance" } } },
      ]);
      expect(aggResult.length).toBe(2);
      const aliceGroup = aggResult.find((g: any) => g._id === "Alice");
      expect(aliceGroup?.totalBalance).toBe(250); // 100 + 150
    });
  });

  test("should expose and allow manual startSession usage", async () => {
    const session = await client.startSession();
    expect(session).toBeDefined();
    expect(typeof session.endSession).toBe("function");

    const User = client.model("users_manual_session", userSchema);
    const user = await User.createOne({ name: "Manual", email: "manual@test.com" }, { session });
    expect(user).toBeDefined();

    await session.endSession();

    expect(session.hasEnded).toBe(true);
  });

  test("should ensure sessions are properly ended even on errors", async () => {
    const User = client.model("users_session_leak", userSchema);

    try {
      await client.transaction(async (ctx) => {
        const ScopedUser = ctx.use(User);
        await ScopedUser.createOne({ name: "LeakTest", email: "leak@test.com" });
        throw new Error("Force failure");
      });
    } catch (err) {
      expect(err).toBeInstanceOf(TransactionError);
    }

    const count = await User.count();
    expect(count).toBe(0);
  });
});
