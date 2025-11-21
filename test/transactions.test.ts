import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { M, MongsterClient } from "../src/index";

let mongod: MongoMemoryServer | null = null;
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
    // Start MongoDB Memory Server with replica set support
    mongod = await MongoMemoryServer.create({
      instance: {
        replSet: "rs0",
      },
    });
    client = new MongsterClient();
    const uri = mongod.getUri();
    await client.connect(uri + "?replicaSet=rs0");
  });

  afterAll(async () => {
    await client.disconnect();
    await mongod?.stop();
  });

  test("should commit transaction when successful", async () => {
    const User = client.model("users_commit", userSchema);

    const result = await client.transaction(async (ctx) => {
      const user = await User.createOne(
        {
          name: "Alice",
          email: "alice@test.com",
        },
        { session: ctx.session },
      );

      await User.updateOne(
        { _id: user?._id },
        { $set: { balance: 100 } },
        { session: ctx.session },
      );

      return user;
    });

    expect(result).toBeDefined();
    expect(result?.name).toBe("Alice");

    // Verify data persisted
    const user = await User.findOne({ email: "alice@test.com" });
    expect(user?.balance).toBe(100);
  });

  test("should rollback transaction on error", async () => {
    const User = client.model("users_rollback", userSchema);

    try {
      await client.transaction(async (ctx) => {
        await User.createOne(
          {
            name: "Bob",
            email: "bob@test.com",
          },
          { session: ctx.session },
        );

        // Simulate an error
        throw new Error("Simulated error");
      });
    } catch (error: any) {
      expect(error.message).toContain("Simulated error");
    }

    // Verify data was rolled back
    const user = await User.findOne({ email: "bob@test.com" });
    expect(user).toBeNull();
  });

  test("should work with transaction.with() for automatic session injection", async () => {
    const User = client.model("users_with", userSchema);
    const Log = client.model("logs_with", logSchema);

    const result = await client.transaction(async () => {
      const TxUser = client.transaction.with(User);
      const TxLog = client.transaction.with(Log);

      const user = await TxUser.createOne({
        name: "Charlie",
        email: "charlie@test.com",
      });

      if (!user) throw new Error("User creation failed");

      await TxLog.createOne({
        userId: user._id,
        action: "created",
      });

      await TxUser.updateOne({ _id: user._id }, { $set: { balance: 50 } });

      return user;
    });

    expect(result).toBeDefined();
    expect(result?.name).toBe("Charlie");

    // Verify both collections have data
    const user = await User.findOne({ email: "charlie@test.com" });
    expect(user?.balance).toBe(50);

    const logs = await Log.find({ userId: user?._id });
    expect(logs.length).toBe(1);
    expect(logs[0]?.action).toBe("created");
  });

  test("should handle complex multi-collection transactions", async () => {
    const User = client.model("users_complex", userSchema);
    const Log = client.model("logs_complex", logSchema);

    // Create initial users
    const alice = await User.createOne({
      name: "Alice",
      email: "alice@complex.com",
      balance: 100,
    });

    const bob = await User.createOne({
      name: "Bob",
      email: "bob@complex.com",
      balance: 50,
    });

    // Transfer money in a transaction
    await client.transaction(async () => {
      const TxUser = client.transaction.with(User);
      const TxLog = client.transaction.with(Log);

      if (!alice || !bob) throw new Error("Users not found");

      // Debit Alice
      await TxUser.updateOne({ _id: alice._id }, { $inc: { balance: -30 } });

      await TxLog.createOne({
        userId: alice._id,
        action: "transfer_out",
        amount: 30,
      });

      // Credit Bob
      await TxUser.updateOne({ _id: bob._id }, { $inc: { balance: 30 } });

      await TxLog.createOne({
        userId: bob._id,
        action: "transfer_in",
        amount: 30,
      });
    });

    // Verify final balances
    const aliceAfter = await User.findOne({ _id: alice?._id });
    const bobAfter = await User.findOne({ _id: bob?._id });

    expect(aliceAfter?.balance).toBe(70);
    expect(bobAfter?.balance).toBe(80);

    // Verify logs were created
    const aliceLogs = await Log.find({ userId: alice?._id });
    const bobLogs = await Log.find({ userId: bob?._id });

    expect(aliceLogs.length).toBe(1);
    expect(bobLogs.length).toBe(1);
  });

  test("should work with transaction options", async () => {
    const User = client.model("users_options", userSchema);

    const result = await client.transaction(
      async () => {
        const TxUser = client.transaction.with(User);

        return await TxUser.createOne({
          name: "Dave",
          email: "dave@test.com",
        });
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );

    expect(result).toBeDefined();
    expect(result?.name).toBe("Dave");
  });

  test("should handle nested operations correctly", async () => {
    const User = client.model("users_nested", userSchema);

    await client.transaction(async () => {
      const TxUser = client.transaction.with(User);

      const users = await TxUser.createMany([
        { name: "User1", email: "user1@test.com" },
        { name: "User2", email: "user2@test.com" },
        { name: "User3", email: "user3@test.com" },
      ]);

      expect(users.length).toBe(3);

      // Update all users
      for (const user of users) {
        await TxUser.updateOne({ _id: user._id }, { $set: { balance: 25 } });
      }

      // Verify count
      const count = await TxUser.count();
      expect(count).toBe(3);
    });

    // Verify all persisted
    const allUsers = await User.find({});
    expect(allUsers.length).toBe(3);
    allUsers.forEach((user) => {
      expect(user.balance).toBe(25);
    });
  });

  test("should rollback all operations on error in middle of transaction", async () => {
    const User = client.model("users_partial_rollback", userSchema);

    try {
      await client.transaction(async () => {
        const TxUser = client.transaction.with(User);

        await TxUser.createOne({ name: "User1", email: "user1@partial.com" });
        await TxUser.createOne({ name: "User2", email: "user2@partial.com" });

        // Error after 2 inserts
        throw new Error("Partial rollback test");
      });
    } catch (error: any) {
      expect(error.message).toBe("Partial rollback test");
    }

    // Verify nothing was persisted
    const users = await User.find({});
    expect(users.length).toBe(0);
  });
});
