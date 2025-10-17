import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongsterSchemaBuilder } from "../src/schema";
import { MongsterClient } from "../src/client";

const M = new MongsterSchemaBuilder();

let mongod: MongoMemoryServer | null = null;
let client: MongsterClient;

describe("Index Automation with MongoDB", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongsterClient();
    await client.connect(mongod.getUri(), {});
  });

  afterAll(async () => {
    await client.disconnect();
    await mongod?.stop();
  });

  describe("syncIndexes() method", () => {
    test("should create indexes on first sync for new collection", async () => {
      const userSchema = M.schema({
        username: M.string().uniqueIndex(),
        email: M.string().uniqueIndex(),
        age: M.number().index(),
        status: M.string(),
      });

      const User = client.model("users_test1", userSchema);

      const result = await User.syncIndexes();

      expect(result.created).toBe(3);
      expect(result.dropped).toBe(0);
      expect(result.unchanged).toBe(0);

      const collection = User.getCollection();
      const indexes = await collection.listIndexes().toArray();

      expect(indexes.length).toBe(4);

      const indexNames = indexes.map((idx) => idx.name);
      expect(indexNames).toContain("_id_");

      const usernameIdx = indexes.find((idx) => idx.key?.username);
      expect(usernameIdx).toBeDefined();
      expect(usernameIdx?.unique).toBe(true);

      const emailIdx = indexes.find((idx) => idx.key?.email);
      expect(emailIdx).toBeDefined();
      expect(emailIdx?.unique).toBe(true);

      const ageIdx = indexes.find((idx) => idx.key?.age);
      expect(ageIdx).toBeDefined();
    });

    test("should not recreate indexes on second sync call", async () => {
      const productSchema = M.schema({
        name: M.string().index(),
        sku: M.string().uniqueIndex(),
      });

      const Product = client.model("products_test2", productSchema);

      const firstResult = await Product.syncIndexes();
      expect(firstResult.created).toBe(2);

      const secondResult = await Product.syncIndexes();
      expect(secondResult.created).toBe(0);
      expect(secondResult.dropped).toBe(0);
      expect(secondResult.unchanged).toBe(0);
    });

    test("should force resync when force=true", async () => {
      const itemSchema = M.schema({
        title: M.string().index(),
        code: M.string().uniqueIndex(),
      });

      const Item = client.model("items_test3", itemSchema);

      await Item.syncIndexes();

      const result = await Item.syncIndexes(true);
      expect(result.created).toBe(0);
      expect(result.dropped).toBe(0);
      expect(result.unchanged).toBe(2);
    });

    test("should drop indexes that no longer exist in schema", async () => {
      const bookSchema = M.schema({
        title: M.string().index(),
        author: M.string().index(),
        isbn: M.string().uniqueIndex(),
      });

      const Book = client.model("books_test4", bookSchema);

      await Book.syncIndexes();

      const updatedSchema = M.schema({
        title: M.string().index(),
        isbn: M.string().uniqueIndex(),
      });

      const UpdatedBook = client.model("books_test4", updatedSchema);

      const result = await UpdatedBook.syncIndexes(true);

      expect(result.dropped).toBe(1);
      expect(result.unchanged).toBe(2);

      const collection = UpdatedBook.getCollection();
      const indexes = await collection.listIndexes().toArray();

      const authorIdx = indexes.find((idx) => idx.key?.author);
      expect(authorIdx).toBeUndefined();
    });

    test("should handle indexes with different options", async () => {
      const postSchema = M.schema({
        title: M.string().textIndex(),
        tags: M.array(M.string()).hashedIndex(),
        userId: M.number().index(-1),
        published: M.boolean().sparseIndex(),
      });

      const Post = client.model("posts_test5", postSchema);

      const result = await Post.syncIndexes();
      expect(result.created).toBe(4);

      const collection = Post.getCollection();
      const indexes = await collection.listIndexes().toArray();

      const textIdx = indexes.find((idx) => idx.textIndexVersion !== undefined);
      expect(textIdx).toBeDefined();
      expect(textIdx?.weights?.title).toBe(1);

      const hashedIdx = indexes.find((idx) => idx.key?.tags === "hashed");
      expect(hashedIdx).toBeDefined();

      const descendingIdx = indexes.find((idx) => idx.key?.userId === -1);
      expect(descendingIdx).toBeDefined();

      const sparseIdx = indexes.find((idx) => idx.key?.published);
      expect(sparseIdx).toBeDefined();
      expect(sparseIdx?.sparse).toBe(true);
    });

    test("should automatically sync indexes before insertOne", async () => {
      const customerSchema = M.schema({
        email: M.string().uniqueIndex(),
        name: M.string(),
      });

      const Customer = client.model("customers_test6", customerSchema);

      await Customer.create({ email: "test@example.com", name: "Test User" });

      const collection = Customer.getCollection();
      const indexes = await collection.listIndexes().toArray();

      const emailIdx = indexes.find((idx) => idx.key?.email);
      expect(emailIdx).toBeDefined();
      expect(emailIdx?.unique).toBe(true);
    });

    test("should automatically sync indexes before insertMany", async () => {
      const orderSchema = M.schema({
        orderId: M.string().uniqueIndex(),
        amount: M.number().index(),
      });

      const Order = client.model("orders_test7", orderSchema);

      await Order.createMany([
        { orderId: "ORD001", amount: 100 } as any,
        { orderId: "ORD002", amount: 200 } as any,
      ]);

      const collection = Order.getCollection();
      const indexes = await collection.listIndexes().toArray();

      expect(indexes.length).toBe(3);
    });

    test("should automatically sync indexes before upsert operations", async () => {
      const sessionSchema = M.schema({
        sessionId: M.string().uniqueIndex(),
        userId: M.string().index(),
      });

      const Session = client.model("sessions_test8", sessionSchema);

      await Session.updateOne(
        { sessionId: "sess123" },
        { $set: { userId: "user456" } },
        { upsert: true },
      );

      const collection = Session.getCollection();
      const indexes = await collection.listIndexes().toArray();

      const sessionIdx = indexes.find((idx) => idx.key?.sessionId);
      expect(sessionIdx).toBeDefined();
      expect(sessionIdx?.unique).toBe(true);
    });

    test("should handle collection that doesn't exist yet", async () => {
      const commentSchema = M.schema({
        postId: M.string().index(),
        content: M.string(),
      });

      const Comment = client.model("comments_test9", commentSchema);

      const result = await Comment.syncIndexes();

      expect(result.created).toBe(1);
      expect(result.dropped).toBe(0);

      const db = client.getDb();
      const collections = await db.listCollections({ name: "comments_test9" }).toArray();
      expect(collections.length).toBe(1);
    });

    test("should handle compound indexes correctly", async () => {
      const logSchema = M.schema({
        userId: M.string(),
        timestamp: M.number(),
        level: M.string(),
      }).addIndex({ userId: 1, timestamp: -1 }, { unique: true });

      const Log = client.model("logs_test10", logSchema);

      const result = await Log.syncIndexes();
      expect(result.created).toBe(1);

      const collection = Log.getCollection();
      const indexes = await collection.listIndexes().toArray();

      const compoundIdx = indexes.find((idx) => idx.key?.userId === 1 && idx.key?.timestamp === -1);
      expect(compoundIdx).toBeDefined();
      expect(compoundIdx?.unique).toBe(true);
    });
  });

  describe("syncIndexesOnConnect option", () => {
    test("should automatically sync all model indexes on connect", async () => {
      const tempClient = new MongsterClient();

      const schema1 = M.schema({
        field1: M.string().uniqueIndex(),
      });
      const schema2 = M.schema({
        field2: M.number().index(),
      });

      const Model1 = tempClient.model("auto_sync_test1", schema1);
      const Model2 = tempClient.model("auto_sync_test2", schema2);

      await tempClient.connect(mongod!.getUri(), { autoIndex: { syncOnConnect: true } });

      const col1 = Model1.getCollection();
      const indexes1 = await col1.listIndexes().toArray();
      expect(indexes1.length).toBeGreaterThan(1);

      const col2 = Model2.getCollection();
      const indexes2 = await col2.listIndexes().toArray();
      expect(indexes2.length).toBeGreaterThan(1);

      await tempClient.disconnect();
    });

    test("should not auto-sync indexes when option is false", async () => {
      const tempClient = new MongsterClient();

      const schema = M.schema({
        testField: M.string().uniqueIndex(),
      });

      const _Model = tempClient.model("no_auto_sync_test", schema);

      await tempClient.connect(mongod!.getUri());

      const db = tempClient.getDb();
      const collections = await db.listCollections({ name: "no_auto_sync_test" }).toArray();
      expect(collections.length).toBe(0);

      await tempClient.disconnect();
    });

    test("should handle models created before client connects", async () => {
      const tempClient = new MongsterClient();

      const schema1 = M.schema({
        userId: M.string().uniqueIndex(),
        email: M.string().index(),
      });
      const schema2 = M.schema({
        productId: M.string().uniqueIndex(),
        name: M.string().textIndex(),
      });
      const schema3 = M.schema({
        sessionId: M.string().index(),
        expiresAt: M.date().ttl(3600),
      });

      const Model1 = tempClient.model("pre_connect_model1", schema1);
      const Model2 = tempClient.model("pre_connect_model2", schema2);
      const Model3 = tempClient.model("pre_connect_model3", schema3);

      await tempClient.connect(mongod!.getUri(), { autoIndex: { syncOnConnect: true } });

      const col1 = Model1.getCollection();
      const indexes1 = await col1.listIndexes().toArray();
      expect(indexes1.length).toBe(3);
      expect(indexes1.find((idx) => idx.key?.userId && idx.unique)).toBeDefined();
      expect(indexes1.find((idx) => idx.key?.email)).toBeDefined();

      const col2 = Model2.getCollection();
      const indexes2 = await col2.listIndexes().toArray();
      expect(indexes2.length).toBe(3);
      expect(indexes2.find((idx) => idx.key?.productId && idx.unique)).toBeDefined();
      expect(indexes2.find((idx) => idx.textIndexVersion)).toBeDefined();

      const col3 = Model3.getCollection();
      const indexes3 = await col3.listIndexes().toArray();
      expect(indexes3.length).toBe(3);
      expect(indexes3.find((idx) => idx.key?.sessionId)).toBeDefined();
      expect(indexes3.find((idx) => idx.expireAfterSeconds === 3600)).toBeDefined();

      await tempClient.disconnect();
    });

    test("should allow operations on models created before connect", async () => {
      const tempClient = new MongsterClient();

      const schema = M.schema({
        username: M.string().uniqueIndex(),
        age: M.number(),
      });

      const Model = tempClient.model("pre_connect_operations", schema);

      await tempClient.connect(mongod!.getUri(), { autoIndex: { syncOnConnect: true } });

      await Model.create({ username: "user1", age: 25 });
      await Model.create({ username: "user2", age: 30 });

      const users = await Model.find({});
      expect(users.length).toBe(2);

      const found = await Model.findOne({ username: "user1" });
      expect(found?.age).toBe(25);

      await expect(Model.create({ username: "user1", age: 35 })).rejects.toThrow();

      await tempClient.disconnect();
    });
  });

  describe("Index validation and error handling", () => {
    test("should enforce unique constraint after index creation", async () => {
      const accountSchema = M.schema({
        accountNumber: M.string().uniqueIndex(),
        balance: M.number(),
      });

      const Account = client.model("accounts_test11", accountSchema);

      await Account.create({ accountNumber: "ACC001", balance: 1000 });

      expect(Account.create({ accountNumber: "ACC001", balance: 2000 })).rejects.toThrow();
    });

    test("should handle empty schema (no indexes)", async () => {
      const simpleSchema = M.schema({
        data: M.string(),
      });

      const Simple = client.model("simple_test12", simpleSchema);

      const result = await Simple.syncIndexes();
      expect(result.created).toBe(0);
      expect(result.dropped).toBe(0);
      expect(result.unchanged).toBe(0);
    });
  });

  describe("Index Creation Edge Cases", () => {
    test("should handle multiple compound indexes", async () => {
      const schema = M.schema({
        field1: M.string(),
        field2: M.number(),
        field3: M.string(),
        field4: M.date(),
      })
        .addIndex({ field1: 1, field2: -1 })
        .addIndex({ field3: 1, field4: -1 })
        .addIndex({ field1: 1, field3: 1 });

      const Model = client.model("multi_compound_test", schema);

      const result = await Model.syncIndexes();
      expect(result.created).toBe(3);

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();

      const compoundIndexes = indexes.filter((idx) => Object.keys(idx.key || {}).length > 1);
      expect(compoundIndexes.length).toBe(3);

      expect(indexes.some((idx) => idx.key?.field1 === 1 && idx.key?.field2 === -1)).toBe(true);
      expect(indexes.some((idx) => idx.key?.field3 === 1 && idx.key?.field4 === -1)).toBe(true);
      expect(indexes.some((idx) => idx.key?.field1 === 1 && idx.key?.field3 === 1)).toBe(true);
    });

    test("should handle compound index with more than 2 fields", async () => {
      const schema = M.schema({
        userId: M.string(),
        category: M.string(),
        timestamp: M.date(),
        status: M.string(),
      }).addIndex({ userId: 1, category: -1, timestamp: -1, status: 1 });

      const Model = client.model("multi_field_compound_test", schema);

      const result = await Model.syncIndexes();
      expect(result.created).toBe(1);

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();

      const compoundIdx = indexes.find(
        (idx) =>
          idx.key?.userId === 1 &&
          idx.key?.category === -1 &&
          idx.key?.timestamp === -1 &&
          idx.key?.status === 1,
      );
      expect(compoundIdx).toBeDefined();
    });

    test("should handle mixed field and compound indexes", async () => {
      const schema = M.schema({
        username: M.string().uniqueIndex(),
        email: M.string().index(),
        firstName: M.string(),
        lastName: M.string(),
        createdAt: M.date().index(),
      })
        .addIndex({ firstName: 1, lastName: 1 })
        .addIndex({ email: 1, createdAt: -1 });

      const Model = client.model("mixed_indexes_test", schema);

      const result = await Model.syncIndexes();
      expect(result.created).toBe(5);

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();

      expect(indexes.find((idx) => idx.key?.username === 1 && idx.unique)).toBeDefined();
      expect(indexes.find((idx) => idx.key?.email === 1 && !idx.key?.createdAt)).toBeDefined();
      expect(indexes.find((idx) => idx.key?.createdAt === 1 && !idx.key?.email)).toBeDefined();
      expect(
        indexes.find((idx) => idx.key?.firstName === 1 && idx.key?.lastName === 1),
      ).toBeDefined();
      expect(
        indexes.find((idx) => idx.key?.email === 1 && idx.key?.createdAt === -1),
      ).toBeDefined();
    });
  });

  describe("Index Modification Detection", () => {
    test("should detect when index options change", async () => {
      const initialSchema = M.schema({
        email: M.string().index(),
        status: M.string().index(),
      });

      const Model = client.model("index_options_change_test", initialSchema);
      await Model.syncIndexes();

      const updatedSchema = M.schema({
        email: M.string().uniqueIndex(),
        status: M.string().sparseIndex(),
      });

      const UpdatedModel = client.model("index_options_change_test", updatedSchema);
      const result = await UpdatedModel.syncIndexes(true);

      expect(result.dropped).toBe(2);
      expect(result.created).toBe(2);

      const collection = UpdatedModel.getCollection();
      const indexes = await collection.listIndexes().toArray();

      const emailIdx = indexes.find((idx) => idx.key?.email);
      expect(emailIdx?.unique).toBe(true);

      const statusIdx = indexes.find((idx) => idx.key?.status);
      expect(statusIdx?.sparse).toBe(true);
    });

    test("should detect when index direction changes", async () => {
      const initialSchema = M.schema({
        timestamp: M.date().index(1),
        priority: M.number().index(1),
      });

      const Model = client.model("index_direction_change_test", initialSchema);
      await Model.syncIndexes();

      const updatedSchema = M.schema({
        timestamp: M.date().index(-1),
        priority: M.number().index(-1),
      });

      const UpdatedModel = client.model("index_direction_change_test", updatedSchema);
      const result = await UpdatedModel.syncIndexes(true);

      expect(result.dropped).toBe(2);
      expect(result.created).toBe(2);

      const collection = UpdatedModel.getCollection();
      const indexes = await collection.listIndexes().toArray();

      expect(indexes.find((idx) => idx.key?.timestamp === -1)).toBeDefined();
      expect(indexes.find((idx) => idx.key?.priority === -1)).toBeDefined();
    });

    test("should detect when index type changes", async () => {
      const initialSchema = M.schema({
        content: M.string().index(),
        tags: M.array(M.string()).index(),
      });

      const Model = client.model("index_type_change_test", initialSchema);
      await Model.syncIndexes();

      const updatedSchema = M.schema({
        content: M.string().textIndex(),
        tags: M.array(M.string()).hashedIndex(),
      });

      const UpdatedModel = client.model("index_type_change_test", updatedSchema);
      const result = await UpdatedModel.syncIndexes(true);

      expect(result.dropped).toBe(2);
      expect(result.created).toBe(2);

      const collection = UpdatedModel.getCollection();
      const indexes = await collection.listIndexes().toArray();

      expect(indexes.find((idx) => idx.textIndexVersion)).toBeDefined();
      expect(indexes.find((idx) => idx.key?.tags === "hashed")).toBeDefined();
    });
  });

  describe("Concurrent Operations", () => {
    test("should handle concurrent syncIndexes calls", async () => {
      const schema = M.schema({
        field1: M.string().index(),
        field2: M.number().uniqueIndex(),
      });

      const Model = client.model("concurrent_sync_test", schema);

      const results = await Promise.all([
        Model.syncIndexes(true),
        Model.syncIndexes(true),
        Model.syncIndexes(true),
      ]);

      results.forEach((result) => {
        expect(result.created + result.unchanged).toBeGreaterThanOrEqual(2);
      });

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();
      expect(indexes.length).toBe(3);
    });

    test("should handle index sync during active writes", async () => {
      const schema = M.schema({
        userId: M.string().index(),
        counter: M.number(),
      });

      const Model = client.model("sync_during_writes_test", schema);

      const writePromises = Array.from({ length: 10 }, (_, i) =>
        Model.create({ userId: `user${i}`, counter: i }),
      );

      const syncPromise = Model.syncIndexes();

      await Promise.all([...writePromises, syncPromise]);

      const count = await Model.count({});
      expect(count).toBe(10);

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();
      expect(indexes.length).toBe(2);
    });
  });

  describe("Error Scenarios", () => {
    test("should handle empty collection name gracefully", async () => {
      const schema = M.schema({
        field: M.string(),
      });

      expect(() => client.model("", schema)).not.toThrow();
    });

    test("should handle schema with reserved field names", async () => {
      const schema = M.schema({
        _id: M.objectId(),
        regularField: M.string().index(),
      });

      const Model = client.model("reserved_fields_test", schema);

      const result = await Model.syncIndexes();
      expect(result.created).toBe(1);

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();

      expect(indexes.find((idx) => idx.name === "_id_")).toBeDefined();
      expect(indexes.find((idx) => idx.key?.regularField)).toBeDefined();
    });
  });

  describe("Performance & Scale", () => {
    test("should handle schema with many indexes", async () => {
      const schema = M.schema({
        field1: M.string().index(),
        field2: M.string().uniqueIndex(),
        field3: M.number().index(),
        field4: M.string().sparseIndex(),
        field5: M.date().index(),
        field6: M.string().index(),
        field7: M.number().index(-1),
        field8: M.boolean().index(),
        field9: M.string().hashedIndex(),
        field10: M.string().textIndex(),
      })
        .addIndex({ field1: 1, field2: 1 })
        .addIndex({ field3: -1, field4: 1 });

      const Model = client.model("many_indexes_test", schema);

      const result = await Model.syncIndexes();
      expect(result.created).toBe(12);

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();
      expect(indexes.length).toBe(13);
    });

    test("should handle syncing across multiple models", async () => {
      const models = Array.from({ length: 10 }, (_, i) => {
        const schema = M.schema({
          [`field${i}`]: M.string().index(),
          data: M.string(),
        });
        return client.model(`multi_model_test_${i}`, schema);
      });

      const results = await Promise.all(models.map((model) => model.syncIndexes()));

      results.forEach((result) => {
        expect(result.created).toBe(1);
      });

      for (const model of models) {
        const indexes = await model.getCollection().listIndexes().toArray();
        expect(indexes.length).toBe(2);
      }
    });
  });

  describe("Special Index Types", () => {
    test("should handle TTL indexes with expireAfterSeconds", async () => {
      const schema = M.schema({
        createdAt: M.date().ttl(3600),
        sessionData: M.string(),
      });

      const Model = client.model("ttl_index_test", schema);

      const result = await Model.syncIndexes();
      expect(result.created).toBe(1);

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();

      const ttlIdx = indexes.find((idx) => idx.expireAfterSeconds !== undefined);
      expect(ttlIdx).toBeDefined();
      expect(ttlIdx?.expireAfterSeconds).toBe(3600);
    });

    test("should handle partial indexes with filter expressions", async () => {
      const schema = M.schema({
        status: M.string().partialIndex({ status: { $eq: "active" } }),
        email: M.string().partialIndex({ email: { $exists: true } }),
      });

      const Model = client.model("partial_index_test", schema);

      const result = await Model.syncIndexes();
      expect(result.created).toBe(2);

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();

      const statusIdx = indexes.find((idx) => idx.key?.status);
      expect(statusIdx?.partialFilterExpression).toBeDefined();
      expect(statusIdx?.partialFilterExpression).toEqual({ status: { $eq: "active" } });

      const emailIdx = indexes.find((idx) => idx.key?.email);
      expect(emailIdx?.partialFilterExpression).toBeDefined();
    });

    test("should handle combination of special index types", async () => {
      const schema = M.schema({
        content: M.string().textIndex(),
        tags: M.array(M.string()).hashedIndex(),
        expiresAt: M.date().ttl(86400),
        status: M.string().partialIndex({ status: { $exists: true } }),
      });

      const Model = client.model("combined_special_indexes_test", schema);

      const result = await Model.syncIndexes();
      expect(result.created).toBe(4);

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();

      expect(indexes.find((idx) => idx.textIndexVersion)).toBeDefined();
      expect(indexes.find((idx) => idx.key?.tags === "hashed")).toBeDefined();
      expect(indexes.find((idx) => idx.expireAfterSeconds === 86400)).toBeDefined();
      const statusIdx = indexes.find((idx) => idx.key?.status);
      expect(statusIdx?.partialFilterExpression).toBeDefined();
    });
  });

  describe("State Management", () => {
    test("should maintain sync state across operations", async () => {
      const schema = M.schema({
        field: M.string().index(),
      });

      const Model = client.model("state_management_test", schema);

      const firstResult = await Model.syncIndexes();
      expect(firstResult.created).toBe(1);

      await Model.create({ field: "test1" });
      await Model.create({ field: "test2" });

      const secondResult = await Model.syncIndexes();
      expect(secondResult.created).toBe(0);
      expect(secondResult.unchanged).toBe(0);
    });

    test("should handle model recreation with same collection name", async () => {
      const schema = M.schema({
        field: M.string().index(),
      });

      const Model1 = client.model("recreation_test", schema);
      await Model1.syncIndexes();

      const Model2 = client.model("recreation_test", schema);
      const result = await Model2.syncIndexes();

      expect(result.unchanged).toBe(1);
    });

    test("should maintain state after client reconnection", async () => {
      const tempClient = new MongsterClient();
      const schema = M.schema({
        field: M.string().index(),
      });

      await tempClient.connect(mongod!.getUri());
      const Model1 = tempClient.model("reconnection_test", schema);
      await Model1.syncIndexes();
      await tempClient.disconnect();

      await tempClient.connect(mongod!.getUri());
      const Model2 = tempClient.model("reconnection_test", schema);
      const result = await Model2.syncIndexes();

      expect(result.created).toBe(0);
      expect(result.dropped).toBe(0);
      expect(result.unchanged).toBe(1);
      await tempClient.disconnect();
    });
  });

  describe("Auto-Sync Triggers", () => {
    test("should auto-sync before findOne operation", async () => {
      const schema = M.schema({
        email: M.string().uniqueIndex(),
        name: M.string(),
      });

      const Model = client.model("findone_autosync_test", schema);

      await Model.create({ email: "test@example.com", name: "Test" });

      const found = await Model.findOne({ email: "test@example.com" });
      expect(found).toBeDefined();

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();
      expect(indexes.find((idx) => idx.key?.email)).toBeDefined();
    });

    test("should not auto-sync for update without upsert", async () => {
      const schema = M.schema({
        userId: M.string().index(),
        counter: M.number(),
      });

      const Model = client.model("update_no_upsert_test", schema);

      const collection = Model.getCollection();
      await collection.insertOne({ userId: "user1", counter: 0 } as any);

      await Model.updateOne({ userId: "user1" }, { $inc: { counter: 1 } });

      const indexes = await collection.listIndexes().toArray();
      expect(indexes.length).toBe(1);
      expect(indexes[0].name).toBe("_id_");
    });

    test("should auto-sync for updateMany with upsert", async () => {
      const schema = M.schema({
        category: M.string().index(),
        count: M.number(),
      });

      const Model = client.model("updatemany_upsert_test", schema);

      await Model.updateMany({ category: "test" }, { $set: { count: 1 } }, { upsert: true });

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();
      expect(indexes.find((idx) => idx.key?.category)).toBeDefined();
    });

    test("should auto-sync for replaceOne with upsert", async () => {
      const schema = M.schema({
        docId: M.string().uniqueIndex(),
        data: M.string(),
      });

      const Model = client.model("replaceone_test", schema);

      await Model.replaceOne(
        { docId: "doc1" },
        { docId: "doc1", data: "replaced" },
        { upsert: true },
      );

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();
      const docIdIdx = indexes.find((idx) => idx.key?.docId);
      expect(docIdIdx).toBeDefined();
      expect(docIdIdx?.unique).toBe(true);
    });
  });

  describe("Backward Compatibility", () => {
    test("should handle pre-existing manual indexes", async () => {
      const collection = client.getDb().collection("manual_indexes_test");

      await collection.createIndex({ manualField: 1 });

      const schema = M.schema({
        manualField: M.string(),
        schemaField: M.string().index(),
      });

      const Model = client.model("manual_indexes_test", schema);
      const result = await Model.syncIndexes();

      expect(result.created).toBe(1);
      expect(result.dropped).toBe(1);

      const indexes = await collection.listIndexes().toArray();
      expect(indexes.find((idx) => idx.key?.schemaField)).toBeDefined();
    });

    test("should handle mixed auto and manual indexes", async () => {
      const collection = client.getDb().collection("mixed_indexes_test");

      await collection.createIndex({ manualIndex: 1 });
      await collection.createIndex({ sharedField: -1 });

      const schema = M.schema({
        manualIndex: M.string(),
        sharedField: M.string().index(),
        autoField: M.string().uniqueIndex(),
      });

      const Model = client.model("mixed_indexes_test", schema);
      const result = await Model.syncIndexes();

      expect(result.created).toBe(2);
      expect(result.dropped).toBe(7); // 5 were created in a previous test case

      const indexes = await collection.listIndexes().toArray();
      expect(indexes.find((idx) => idx.key?.sharedField === 1)).toBeDefined();
      expect(indexes.find((idx) => idx.key?.autoField && idx.unique)).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    test("should handle very long field names in indexes", async () => {
      const longFieldName = "a".repeat(100);
      const schema = M.schema({
        [longFieldName]: M.string().index(),
        normalField: M.string(),
      });

      const Model = client.model("long_field_name_test", schema);

      const result = await Model.syncIndexes();
      expect(result.created).toBe(1);

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();
      expect(indexes.find((idx) => idx.key?.[longFieldName])).toBeDefined();
    });

    test("should handle indexes on deeply nested paths", async () => {
      const schema = M.schema({
        level1: M.object({
          level2: M.object({
            level3: M.object({
              level4: M.object({
                deepField: M.string().index(),
              }),
            }),
          }),
        }),
      });

      const Model = client.model("deep_nested_index_test", schema);

      const result = await Model.syncIndexes();
      expect(result.created).toBe(1);

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();
      expect(
        indexes.find((idx) => idx.key?.["level1.level2.level3.level4.deepField"]),
      ).toBeDefined();
    });

    test("should throw error for duplicate index definitions", async () => {
      const schema = M.schema({
        field: M.string(),
      })
        .addIndex({ field: 1 })
        .addIndex({ field: 1 })
        .addIndex({ field: 1 });

      const Model = client.model("duplicate_index_test", schema);

      expect(Model.syncIndexes()).rejects.toThrow(/Identical index already exists/);
    });

    test("should handle index sync on collection with existing data", async () => {
      const collection = client.getDb().collection("existing_data_test");

      await collection.insertMany([
        { email: "user1@test.com", name: "User 1" },
        { email: "user2@test.com", name: "User 2" },
        { email: "user3@test.com", name: "User 3" },
      ]);

      const schema = M.schema({
        email: M.string().uniqueIndex(),
        name: M.string().index(),
      });

      const Model = client.model("existing_data_test", schema);
      const result = await Model.syncIndexes();

      expect(result.created).toBe(2);

      const indexes = await collection.listIndexes().toArray();
      expect(indexes.find((idx) => idx.key?.email && idx.unique)).toBeDefined();
      expect(indexes.find((idx) => idx.key?.name)).toBeDefined();

      const count = await collection.countDocuments();
      expect(count).toBe(3);
    });

    test("should handle index on optional fields", async () => {
      const schema = M.schema({
        requiredField: M.string().index(),
        optionalField: M.string().optional().index(),
      });

      const Model = client.model("optional_field_index_test", schema);

      const result = await Model.syncIndexes();
      expect(result.created).toBe(2);

      await Model.create({ requiredField: "test" });
      await Model.create({ requiredField: "test2", optionalField: "optional" });

      const collection = Model.getCollection();
      const indexes = await collection.listIndexes().toArray();
      expect(indexes.find((idx) => idx.key?.optionalField)).toBeDefined();
    });
  });
});
