import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Decimal128, ObjectId } from "mongodb";
import { MongsterSchemaBuilder } from "../src/schema";
import { MongsterClient } from "../src/client";

const M = new MongsterSchemaBuilder();

let mongod: MongoMemoryServer | null = null;
let client: MongsterClient;

describe("CRUD Operations Edge Cases", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongsterClient();
    await client.connect(mongod.getUri(), {});
  });

  afterAll(async () => {
    await client.disconnect();
    await mongod?.stop();
  });

  describe("Create Operations", () => {
    test("should handle creating document with defaultFn values", async () => {
      const schema = M.schema({
        name: M.string(),
        counter: M.number().defaultFn(() => Math.random()),
      }).withTimestamps();

      const Model = client.model("default_fn_test", schema);

      const doc = await Model.createOne({ name: "test" });

      expect(doc?.createdAt).toBeInstanceOf(Date);
      expect(doc?.updatedAt).toBeInstanceOf(Date);
      expect(doc?.counter).toBeTypeOf("number");
      expect(doc?.name).toBe("test");
    });

    test("should handle createMany with validation errors on some documents", async () => {
      const schema = M.schema({
        age: M.number().min(0).max(120),
        name: M.string(),
      });

      const Model = client.model("create_many_validation_test", schema);

      expect(
        Model.createMany([
          { age: 25, name: "valid" },
          { age: 150, name: "invalid" },
        ]),
      ).rejects.toThrow();
    });

    test("should preserve ObjectId type for _id field", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const Model = client.model("objectid_test", schema);

      const doc = await Model.createOne({ name: "test" });

      expect(doc?._id).toBeInstanceOf(ObjectId);
    });

    test("should handle creating document with nested optional fields", async () => {
      const schema = M.schema({
        profile: M.object({
          bio: M.string().optional(),
          age: M.number().optional(),
        }).optional(),
        name: M.string(),
      });

      const Model = client.model("nested_optional_test", schema);

      const doc1 = await Model.createOne({ name: "user1" });
      expect(doc1?.profile).toBeUndefined();

      const doc2 = await Model.createOne({ name: "user2", profile: { bio: "hello" } });
      expect(doc2?.profile?.bio).toBe("hello");
      expect(doc2?.profile?.age).toBeUndefined();
    });

    test("should handle creating with custom _id", async () => {
      const customId = new ObjectId();
      const schema = M.schema({
        name: M.string(),
      });

      const Model = client.model("custom_id_test", schema);

      const doc = await Model.createOne({ _id: customId, name: "test" });

      expect(doc?._id.toString()).toBe(customId.toString());
    });
  });

  describe("Update Operations", () => {
    test("should handle updateOne with $set on nested fields", async () => {
      const schema = M.schema({
        profile: M.object({
          name: M.string(),
          age: M.number(),
        }),
      });

      const Model = client.model("nested_update_test", schema);

      await Model.createOne({ profile: { name: "John", age: 30 } });

      const result = await Model.updateOne(
        { "profile.name": "John" },
        { $set: { "profile.age": 31 } },
      );

      expect(result.modifiedCount).toBe(1);

      const doc = await Model.findOne({ "profile.name": "John" });
      expect(doc?.profile.age).toBe(31);
    });

    test("should handle updateMany with no matching documents", async () => {
      const schema = M.schema({
        status: M.string(),
      });

      const Model = client.model("update_no_match_test", schema);

      const result = await Model.updateMany(
        { status: "nonexistent" },
        { $set: { status: "updated" } },
      );

      expect(result.matchedCount).toBe(0);
      expect(result.modifiedCount).toBe(0);
    });

    test("should handle updateOne with upsert creating new document", async () => {
      const schema = M.schema({
        key: M.string().uniqueIndex(),
        value: M.number(),
      });

      const Model = client.model("upsert_test", schema);

      const result = await Model.updateOne(
        { key: "unique_key" },
        { $set: { value: 100 } },
        { upsert: true },
      );

      expect(result.upsertedCount).toBe(1);
      expect(result.upsertedId).toBeDefined();

      const doc = await Model.findOne({ key: "unique_key" });
      expect(doc?.value).toBe(100);
    });

    test("should handle $inc operator correctly", async () => {
      const schema = M.schema({
        counter: M.number(),
        name: M.string(),
      });

      const Model = client.model("inc_test", schema);

      await Model.createOne({ counter: 10, name: "test" });

      await Model.updateOne({ name: "test" }, { $inc: { counter: 5 } });

      const doc = await Model.findOne({ name: "test" });
      expect(doc?.counter).toBe(15);
    });

    test("should handle $push to array fields", async () => {
      const schema = M.schema({
        tags: M.array(M.string()),
        name: M.string(),
      });

      const Model = client.model("push_test", schema);

      await Model.createOne({ tags: ["tag1"], name: "test" });

      await Model.updateOne({ name: "test" }, { $push: { tags: "tag2" } } as any);

      const doc = await Model.findOne({ name: "test" });
      expect(doc?.tags).toEqual(["tag1", "tag2"]);
    });

    test("should handle $unset to remove fields", async () => {
      const schema = M.schema({
        name: M.string(),
        description: M.string().optional(),
      });

      const Model = client.model("unset_test", schema);

      await Model.createOne({ name: "test", description: "desc" });

      await Model.updateOne({ name: "test" }, { $unset: { description: "" } } as any);

      const doc = await Model.findOne({ name: "test" });
      expect(doc?.description).toBeUndefined();
    });
  });

  describe("Replace Operations", () => {
    test("should completely replace document preserving _id", async () => {
      const schema = M.schema({
        name: M.string(),
        age: M.number(),
        status: M.string(),
      });

      const Model = client.model("replace_test", schema);

      const original = await Model.createOne({ name: "John", age: 30, status: "active" });

      if (!original) return;

      await Model.replaceOne({ _id: original._id }, { name: "Jane", age: 25, status: "inactive" });

      const replaced = await Model.findOne({ _id: original._id });

      expect(replaced?.name).toBe("Jane");
      expect(replaced?.age).toBe(25);
      expect(replaced?.status).toBe("inactive");
      expect(replaced?._id).toBeDefined();
      expect(replaced?._id.toString()).toBe(original._id.toString());
    });

    test("should handle replaceOne with upsert", async () => {
      const schema = M.schema({
        key: M.string().uniqueIndex(),
        data: M.string(),
      });

      const Model = client.model("replace_upsert_test", schema);

      const result = await Model.replaceOne(
        { key: "new_key" },
        { key: "new_key", data: "new_data" },
        { upsert: true },
      );

      expect(result.upsertedCount).toBe(1);

      const doc = await Model.findOne({ key: "new_key" });
      expect(doc?.data).toBe("new_data");
    });

    test("should handle replaceOne with no match and no upsert", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const Model = client.model("replace_no_match_test", schema);

      const result = await Model.replaceOne({ name: "nonexistent" }, { name: "new" });

      expect(result.matchedCount).toBe(0);
      expect(result.modifiedCount).toBe(0);
    });
  });

  describe("Delete Operations", () => {
    test("should handle deleteOne with no matching documents", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const Model = client.model("delete_no_match_test", schema);

      const result = await Model.deleteOne({ name: "nonexistent" });

      expect(result.deletedCount).toBe(0);
    });

    test("should handle deleteMany removing multiple documents", async () => {
      const schema = M.schema({
        category: M.string(),
        name: M.string(),
      });

      const Model = client.model("delete_many_test", schema);

      await Model.createMany([
        { category: "A", name: "item1" },
        { category: "A", name: "item2" },
        { category: "B", name: "item3" },
      ] as any);

      const result = await Model.deleteMany({ category: "A" });

      expect(result.deletedCount).toBe(2);

      const remaining = await Model.count({});
      expect(remaining).toBe(1);
    });

    test("should handle deleteMany with empty filter", async () => {
      const schema = M.schema({
        data: M.string(),
      });

      const Model = client.model("delete_all_test", schema);

      await Model.createMany([{ data: "1" }, { data: "2" }, { data: "3" }] as any);

      const result = await Model.deleteMany({});

      expect(result.deletedCount).toBe(3);

      const count = await Model.count({});
      expect(count).toBe(0);
    });
  });

  describe("Query Operations Edge Cases", () => {
    test("should handle find with sorting", async () => {
      const schema = M.schema({
        name: M.string(),
        age: M.number(),
      });

      const Model = client.model("sort_test", schema);

      await Model.createMany([
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
        { name: "Charlie", age: 35 },
      ] as any);

      const docs = await Model.find({}, { sort: { age: 1 } });

      expect(docs.length).toBe(3);
      expect(docs[0]?.name).toBe("Bob");
      expect(docs[1]?.name).toBe("Alice");
      expect(docs[2]?.name).toBe("Charlie");
    });

    test("should handle find with limit and skip", async () => {
      const schema = M.schema({
        index: M.number(),
      });

      const Model = client.model("pagination_test", schema);

      await Model.createMany([
        { index: 1 },
        { index: 2 },
        { index: 3 },
        { index: 4 },
        { index: 5 },
      ] as any);

      const docs = await Model.find({}, { sort: { index: 1 }, skip: 2, limit: 2 });

      expect(docs.length).toBe(2);
      expect(docs[0]?.index).toBe(3);
      expect(docs[1]?.index).toBe(4);
    });

    test("should handle findOne returning null for no match", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const Model = client.model("find_one_null_test", schema);

      const doc = await Model.findOne({ name: "nonexistent" });

      expect(doc).toBeNull();
    });

    test("should handle distinct returning unique values", async () => {
      const schema = M.schema({
        category: M.string(),
        value: M.number(),
      });

      const Model = client.model("distinct_test", schema);

      await Model.createMany([
        { category: "A", value: 1 },
        { category: "B", value: 2 },
        { category: "A", value: 3 },
        { category: "C", value: 4 },
      ] as any);

      const categories = await Model.distinct("category");

      expect(categories.sort()).toEqual(["A", "B", "C"]);
    });

    test("should handle count with filter", async () => {
      const schema = M.schema({
        status: M.string(),
        value: M.number(),
      });

      const Model = client.model("count_filter_test", schema);

      await Model.createMany([
        { status: "active", value: 1 },
        { status: "inactive", value: 2 },
        { status: "active", value: 3 },
      ] as any);

      const activeCount = await Model.count({ status: "active" });
      const totalCount = await Model.count({});

      expect(activeCount).toBe(2);
      expect(totalCount).toBe(3);
    });

    test("should handle complex query operators", async () => {
      const schema = M.schema({
        age: M.number(),
        score: M.number(),
      });

      const Model = client.model("complex_query_test", schema);

      await Model.createMany([
        { age: 25, score: 80 },
        { age: 30, score: 90 },
        { age: 35, score: 70 },
        { age: 40, score: 95 },
      ] as any);

      const docs = await Model.find({
        age: { $gte: 30 },
        score: { $gt: 85 },
      });

      expect(docs.length).toBe(2);
      expect(docs.some((d) => d.age === 30 && d.score === 90)).toBe(true);
      expect(docs.some((d) => d.age === 40 && d.score === 95)).toBe(true);
    });
  });

  describe("Validation Edge Cases", () => {
    test("should enforce min/max constraints on create", async () => {
      const schema = M.schema({
        age: M.number().min(0).max(120),
      });

      const Model = client.model("validation_min_max_test", schema);

      await expect(Model.createOne({ age: -1 } as any)).rejects.toThrow();
      await expect(Model.createOne({ age: 150 } as any)).rejects.toThrow();

      const valid = await Model.createOne({ age: 50 });
      expect(valid?.age).toBe(50);
    });

    test("should enforce string length constraints", async () => {
      const schema = M.schema({
        username: M.string().min(3).max(20),
      });

      const Model = client.model("validation_string_length_test", schema);

      await expect(Model.createOne({ username: "ab" } as any)).rejects.toThrow();
      await expect(Model.createOne({ username: "a".repeat(21) } as any)).rejects.toThrow();

      const valid = await Model.createOne({ username: "validuser" });
      expect(valid?.username).toBe("validuser");
    });

    test("should enforce enum constraints", async () => {
      const schema = M.schema({
        status: M.string().enum(["active", "inactive", "pending"]),
      });

      const Model = client.model("validation_enum_test", schema);

      await expect(Model.createOne({ status: "invalid" } as any)).rejects.toThrow();

      const valid = await Model.createOne({ status: "active" });
      expect(valid?.status).toBe("active");
    });

    test("should handle nullable vs optional correctly", async () => {
      const schema = M.schema({
        nullableField: M.string().nullable(),
        optionalField: M.string().optional(),
      });

      const Model = client.model("nullable_optional_test", schema);

      const doc1 = await Model.createOne({ nullableField: null, optionalField: undefined });
      expect(doc1?.nullableField).toBeNull();
      expect(doc1?.optionalField).toBeUndefined();

      await expect(Model.createOne({ nullableField: undefined } as any)).rejects.toThrow();
    });
  });

  describe("Array Operations", () => {
    test("should handle array min/max length validation", async () => {
      const schema = M.schema({
        tags: M.array(M.string()).min(1).max(5),
      });

      const Model = client.model("array_length_test", schema);

      await expect(Model.createOne({ tags: [] } as any)).rejects.toThrow();
      await expect(Model.createOne({ tags: Array(6).fill("tag") } as any)).rejects.toThrow();

      const valid = await Model.createOne({ tags: ["tag1", "tag2"] });
      expect(valid?.tags.length).toBe(2);
    });

    test("should handle nested array operations", async () => {
      const schema = M.schema({
        matrix: M.array(M.array(M.number())),
      });

      const Model = client.model("nested_array_test", schema);

      const doc = await Model.createOne({
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      });

      expect(doc?.matrix).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });

    test("should handle $addToSet to prevent duplicate array elements", async () => {
      const schema = M.schema({
        tags: M.array(M.string()),
        name: M.string(),
      });

      const Model = client.model("add_to_set_test", schema);

      await Model.createOne({ tags: ["tag1", "tag2"], name: "test" });

      await Model.updateOne({ name: "test" }, { $addToSet: { tags: "tag2" } } as any);

      const doc1 = await Model.findOne({ name: "test" });
      expect(doc1?.tags).toEqual(["tag1", "tag2"]);

      await Model.updateOne({ name: "test" }, { $addToSet: { tags: "tag3" } } as any);

      const doc2 = await Model.findOne({ name: "test" });
      expect(doc2?.tags).toEqual(["tag1", "tag2", "tag3"]);
    });

    test("should handle $pull to remove array elements", async () => {
      const schema = M.schema({
        numbers: M.array(M.number()),
        name: M.string(),
      });

      const Model = client.model("pull_test", schema);

      await Model.createOne({ numbers: [1, 2, 3, 2, 4], name: "test" });

      await Model.updateOne({ name: "test" }, { $pull: { numbers: 2 } } as any);

      const doc = await Model.findOne({ name: "test" });
      expect(doc?.numbers).toEqual([1, 3, 4]);
    });
  });

  describe("ObjectId and BSON Types", () => {
    test("should handle queries with ObjectId", async () => {
      const schema = M.schema({
        userId: M.objectId(),
        name: M.string(),
      });

      const Model = client.model("objectid_query_test", schema);

      const userId = new ObjectId();
      await Model.createOne({ userId, name: "test" });

      const doc = await Model.findOne({ userId });
      expect(doc?.userId.toString()).toBe(userId.toString());
    });

    test("should handle date queries with comparison operators", async () => {
      const schema = M.schema({
        createdAt: M.date(),
        name: M.string(),
      });

      const Model = client.model("date_query_test", schema);

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await Model.createMany([
        { createdAt: yesterday, name: "old" },
        { createdAt: now, name: "current" },
        { createdAt: tomorrow, name: "future" },
      ] as any);

      const recentDocs = await Model.find({ createdAt: { $gte: now } });
      expect(recentDocs.length).toBe(2);
    });

    test("should handle Decimal128 for precise numbers", async () => {
      const schema = M.schema({
        price: M.decimal(),
        product: M.string(),
      });

      const Model = client.model("decimal_test", schema);

      const doc = await Model.createOne({
        price: Decimal128.fromString("99.99"),
        product: "widget",
      });

      expect(doc?.price).toBeDefined();
      expect(doc?.product).toBe("widget");
    });
  });

  describe("Concurrent Operations", () => {
    test("should handle concurrent creates without conflicts", async () => {
      const schema = M.schema({
        value: M.number(),
      });

      const Model = client.model("concurrent_create_test", schema);

      const promises = Array.from({ length: 10 }, (_, i) => Model.createOne({ value: i }));

      const results = await Promise.all(promises);

      expect(results.every((r) => r !== null)).toBe(true);

      const count = await Model.count({});
      expect(count).toBe(10);
    });

    test("should handle concurrent updates on same document", async () => {
      const schema = M.schema({
        counter: M.number(),
        name: M.string(),
      });

      const Model = client.model("concurrent_update_test", schema);

      await Model.createOne({ counter: 0, name: "test" });

      const promises = Array.from({ length: 5 }, () =>
        Model.updateOne({ name: "test" }, { $inc: { counter: 1 } }),
      );

      await Promise.all(promises);

      const doc = await Model.findOne({ name: "test" });
      expect(doc?.counter).toBe(5);
    });
  });

  describe("Bulk Operations", () => {
    test("should handle large batch creates efficiently", async () => {
      const schema = M.schema({
        index: M.number(),
      });

      const Model = client.model("bulk_create_test", schema);

      const docs = Array.from({ length: 100 }, (_, i) => ({ index: i }));

      const results = await Model.createMany(docs as any);

      expect(results.length).toBe(100);

      const count = await Model.count({});
      expect(count).toBe(100);
    });

    test("should handle updateMany affecting multiple documents", async () => {
      const schema = M.schema({
        category: M.string(),
        processed: M.boolean(),
      });

      const Model = client.model("bulk_update_test", schema);

      await Model.createMany([
        { category: "A", processed: false },
        { category: "A", processed: false },
        { category: "B", processed: false },
      ] as any);

      const result = await Model.updateMany({ category: "A" }, { $set: { processed: true } });

      expect(result.modifiedCount).toBe(2);

      const processedCount = await Model.count({ processed: true });
      expect(processedCount).toBe(2);
    });
  });
});
