import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongsterClient } from "../src/client";
import { MongsterSchemaBuilder } from "../src/schema";

const M = new MongsterSchemaBuilder();

let replSet: MongoMemoryReplSet;
let client: MongsterClient;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = new MongsterClient(replSet.getUri());
  await client.connect();
});

afterAll(async () => {
  await client.disconnect();
  await replSet.stop();
});

describe("Hooks", () => {
  describe("Schema-level pre hooks", () => {
    test("pre insertOne modifies doc before insert", async () => {
      const schema = M.schema({
        name: M.string(),
        tag: M.string().default("none"),
      });

      schema.pre("createOne", (ctx) => {
        return { doc: { ...ctx.doc, tag: "pre-hooked" } };
      });

      const model = client.model("hooks_pre_insert", schema);
      const created = await model.createOne({ name: "test" });
      expect(created?.tag).toBe("pre-hooked");
    });

    test("pre insertOne void return keeps original", async () => {
      const schema = M.schema({
        name: M.string(),
        count: M.number().default(0),
      });

      const calls: string[] = [];
      schema.pre("insertOne", () => {
        calls.push("pre");
      });

      const model = client.model("hooks_pre_void", schema);
      await model.insertOne({ name: "test" });
      expect(calls).toEqual(["pre"]);
    });

    test("pre hook throw aborts operation", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      schema.pre("insertOne", () => {
        throw new Error("blocked by pre hook");
      });

      const model = client.model("hooks_pre_throw", schema);
      expect(model.insertOne({ name: "test" })).rejects.toThrow("blocked by pre hook");
    });

    test("post insertOne receives result", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      let capturedResult: any = null;
      schema.post("insertOne", (ctx) => {
        capturedResult = ctx.result;
      });

      const model = client.model("hooks_post_insert", schema);
      const result = await model.insertOne({ name: "test" });
      expect(capturedResult).toBeDefined();
      expect(capturedResult.acknowledged).toBe(true);
      expect(capturedResult.insertedId).toEqual(result.insertedId);
    });

    test("post createOne receives created doc", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      let capturedResult: any = null;
      schema.post("createOne", (ctx) => {
        capturedResult = ctx.result;
      });

      const model = client.model("hooks_post_create", schema);
      const created = await model.createOne({ name: "alice" });
      expect(capturedResult).toBeDefined();
      expect(capturedResult.name).toBe("alice");
      expect(capturedResult._id).toEqual(created?._id);
    });
  });

  describe("Model-level hooks", () => {
    test("model pre hook fires before schema pre hook", async () => {
      const schema = M.schema({
        name: M.string(),
        order: M.string().default(""),
      });

      const order: string[] = [];

      schema.pre("insertOne", () => {
        order.push("schema-pre");
      });

      const model = client.model("hooks_model_order", schema);

      model.pre("insertOne", () => {
        order.push("model-pre");
      });

      await model.insertOne({ name: "test" });

      // Model pre → Schema pre
      expect(order).toEqual(["model-pre", "schema-pre"]);
    });

    test("schema post fires before model post", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const order: string[] = [];

      schema.post("insertOne", () => {
        order.push("schema-post");
      });

      const model = client.model("hooks_post_order", schema);

      model.post("insertOne", () => {
        order.push("model-post");
      });

      await model.insertOne({ name: "test" });

      // Schema post → Model post
      expect(order).toEqual(["schema-post", "model-post"]);
    });

    test("full execution order: model-pre → schema-pre → exec → schema-post → model-post", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const order: string[] = [];

      schema.pre("insertOne", () => {
        order.push("schema-pre");
      });
      schema.post("insertOne", () => {
        order.push("schema-post");
      });

      const model = client.model("hooks_full_order", schema);

      model.pre("insertOne", () => {
        order.push("model-pre");
      });
      model.post("insertOne", () => {
        order.push("model-post");
      });

      await model.insertOne({ name: "test" });

      expect(order).toEqual(["model-pre", "schema-pre", "schema-post", "model-post"]);
    });
  });

  describe("Group aliases", () => {
    test("'save' alias fires on insertOne and createOne", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const ops: string[] = [];
      schema.pre("save", () => {
        ops.push("save-pre");
      });

      const model = client.model("hooks_save_alias", schema);
      await model.insertOne({ name: "a" });
      await model.createOne({ name: "b" });

      expect(ops).toEqual(["save-pre", "save-pre"]);
    });

    test("'modify' alias fires on updateOne", async () => {
      const schema = M.schema({
        name: M.string(),
        value: M.number(),
      });

      const ops: string[] = [];
      schema.pre("modify", () => {
        ops.push("modify-pre");
      });

      const model = client.model("hooks_modify_alias", schema);
      await model.insertOne({ name: "x", value: 1 });
      await model.updateOne({ name: "x" }, { $set: { value: 2 } });

      expect(ops).toEqual(["modify-pre"]);
    });

    test("'remove' alias fires on deleteOne and deleteMany", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const ops: string[] = [];
      schema.pre("remove", () => {
        ops.push("remove-pre");
      });

      const model = client.model("hooks_remove_alias", schema);
      await model.insertOne({ name: "a" });
      await model.insertOne({ name: "b" });
      await model.deleteOne({ name: "a" });
      await model.deleteMany({});

      expect(ops).toEqual(["remove-pre", "remove-pre"]);
    });
  });

  describe("Multiple hooks", () => {
    test("multiple pre hooks run in registration order", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const order: number[] = [];
      schema.pre("insertOne", () => {
        order.push(1);
      });
      schema.pre("insertOne", () => {
        order.push(2);
      });
      schema.pre("insertOne", () => {
        order.push(3);
      });

      const model = client.model("hooks_multi_pre", schema);
      await model.insertOne({ name: "test" });

      expect(order).toEqual([1, 2, 3]);
    });

    test("multiple post hooks run in registration order", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const order: number[] = [];
      schema.post("insertOne", () => {
        order.push(1);
      });
      schema.post("insertOne", () => {
        order.push(2);
      });

      const model = client.model("hooks_multi_post", schema);
      await model.insertOne({ name: "test" });

      expect(order).toEqual([1, 2]);
    });
  });

  describe("Pre hook return-based mutation", () => {
    test("model pre modifies doc, schema pre sees modified version", async () => {
      const schema = M.schema({
        name: M.string(),
        source: M.string().default("unknown"),
      });

      schema.pre("createOne", (ctx) => {
        // Schema pre should see name already modified by model pre
        expect(ctx.doc.name).toBe("MODEL_MODIFIED");
      });

      const model = client.model("hooks_chain_mutation", schema);

      model.pre("createOne", (ctx) => {
        return { doc: { ...ctx.doc, name: "MODEL_MODIFIED" } };
      });

      const created = await model.createOne({ name: "original" });
      expect(created?.name).toBe("MODEL_MODIFIED");
    });

    test("pre updateOne modifies filter", async () => {
      const schema = M.schema({
        name: M.string(),
        status: M.string(),
      });

      schema.pre("updateOne", (ctx) => {
        // Add soft-delete filter
        return { ...ctx, filter: { ...ctx.filter, status: "active" } };
      });

      const model = client.model("hooks_pre_update_filter", schema);
      await model.insertOne({ name: "a", status: "active" });
      await model.insertOne({ name: "b", status: "inactive" });

      await model.updateOne({ name: "b" }, { $set: { name: "b_updated" } });

      // b should NOT be updated because hook added status: "active" filter
      const b = await model.findOne({ status: "inactive" });
      expect(b?.name).toBe("b");
    });
  });

  describe("Find hooks", () => {
    test("pre find modifies filter", async () => {
      const schema = M.schema({
        name: M.string(),
        active: M.boolean(),
      });

      schema.pre("find", (ctx) => {
        return { filter: { ...ctx.filter, active: true } };
      });

      const model = client.model("hooks_pre_find", schema);
      await model.insertOne({ name: "visible", active: true });
      await model.insertOne({ name: "hidden", active: false });

      const results = await model.find({}).exec();
      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe("visible");
    });

    test("post find receives results", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      let capturedResults: any[] = [];
      schema.post("find", (ctx) => {
        capturedResults = ctx.result;
      });

      const model = client.model("hooks_post_find", schema);
      await model.insertOne({ name: "x" });
      await model.insertOne({ name: "y" });

      const results = await model.find({}).exec();
      expect(capturedResults.length).toBe(2);
      expect(capturedResults).toEqual(results);
    });

    test("find hooks work with sort/limit/skip", async () => {
      const schema = M.schema({
        name: M.string(),
        rank: M.number(),
      });

      let capturedCount = 0;
      schema.post("find", (ctx) => {
        capturedCount = ctx.result.length;
      });

      const model = client.model("hooks_find_chain", schema);
      await model.insertOne({ name: "a", rank: 3 });
      await model.insertOne({ name: "b", rank: 1 });
      await model.insertOne({ name: "c", rank: 2 });

      const results = await model.find({}).sort({ rank: 1 }).limit(2).exec();
      expect(results.length).toBe(2);
      expect(results[0]?.name).toBe("b");
      expect(capturedCount).toBe(2);
    });

    test("find hooks work with await (thenable)", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      let hooked = false;
      schema.post("find", () => {
        hooked = true;
      });

      const model = client.model("hooks_find_await", schema);
      await model.insertOne({ name: "test" });

      const results = await model.find({});
      expect(results.length).toBe(1);
      expect(hooked).toBe(true);
    });

    test("pre findOne modifies filter", async () => {
      const schema = M.schema({
        name: M.string(),
        visible: M.boolean(),
      });

      schema.pre("findOne", (ctx) => {
        return { filter: { ...ctx.filter, visible: true } };
      });

      const model = client.model("hooks_pre_findone", schema);
      await model.insertOne({ name: "hidden", visible: false });
      await model.insertOne({ name: "shown", visible: true });

      const result = await model.findOne({ name: "hidden" });
      // Should not find "hidden" because hook adds visible: true
      expect(result).toBeNull();

      const visible = await model.findOne({ name: "shown" });
      expect(visible?.name).toBe("shown");
    });
  });

  describe("Async hooks", () => {
    test("async pre hook works", async () => {
      const schema = M.schema({
        name: M.string(),
        processed: M.boolean().default(false),
      });

      schema.pre("createOne", async (ctx) => {
        await new Promise((r) => setTimeout(r, 10));
        return { doc: { ...ctx.doc, processed: true } };
      });

      const model = client.model("hooks_async_pre", schema);
      const created = await model.createOne({ name: "test" });
      expect(created?.processed).toBe(true);
    });

    test("async post hook works", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      let asyncDone = false;
      schema.post("insertOne", async () => {
        await new Promise((r) => setTimeout(r, 10));
        asyncDone = true;
      });

      const model = client.model("hooks_async_post", schema);
      await model.insertOne({ name: "test" });
      expect(asyncDone).toBe(true);
    });
  });

  describe("Delete hooks", () => {
    test("pre/post deleteOne fire correctly", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      let preFilter: any = null;
      let postResult: any = null;

      schema.pre("deleteOne", (ctx) => {
        preFilter = ctx.filter;
      });
      schema.post("deleteOne", (ctx) => {
        postResult = ctx.result;
      });

      const model = client.model("hooks_delete_one", schema);
      await model.insertOne({ name: "target" });
      await model.deleteOne({ name: "target" });

      expect(preFilter).toEqual({ name: "target" });
      expect(postResult.deletedCount).toBe(1);
    });

    test("pre/post deleteMany fire correctly", async () => {
      const schema = M.schema({
        name: M.string(),
        group: M.string(),
      });

      let postResult: any = null;
      schema.post("deleteMany", (ctx) => {
        postResult = ctx.result;
      });

      const model = client.model("hooks_delete_many", schema);
      await model.insertOne({ name: "a", group: "x" });
      await model.insertOne({ name: "b", group: "x" });
      await model.insertOne({ name: "c", group: "y" });

      await model.deleteMany({ group: "x" });
      expect(postResult.deletedCount).toBe(2);
    });
  });

  describe("Update hooks", () => {
    test("pre/post updateMany fire correctly", async () => {
      const schema = M.schema({
        name: M.string(),
        score: M.number(),
      });

      let preFired = false;
      let postResult: any = null;

      schema.pre("updateMany", () => {
        preFired = true;
      });
      schema.post("updateMany", (ctx) => {
        postResult = ctx.result;
      });

      const model = client.model("hooks_update_many", schema);
      await model.insertOne({ name: "a", score: 1 });
      await model.insertOne({ name: "b", score: 2 });

      await model.updateMany({}, { $inc: { score: 10 } });

      expect(preFired).toBe(true);
      expect(postResult.modifiedCount).toBe(2);
    });

    test("pre/post findOneAndUpdate fire correctly", async () => {
      const schema = M.schema({
        name: M.string(),
        version: M.number(),
      });

      let postDoc: any = null;
      schema.post("findOneAndUpdate", (ctx) => {
        postDoc = ctx.result;
      });

      const model = client.model("hooks_find_and_update", schema);
      await model.insertOne({ name: "doc", version: 1 });

      await model.findOneAndUpdate(
        { name: "doc" },
        { $set: { version: 2 } },
        { includeResultMetadata: true, returnDocument: "after" },
      );

      expect(postDoc).toBeDefined();
    });
  });

  describe("Replace hooks", () => {
    test("pre/post replaceOne fire correctly", async () => {
      const schema = M.schema({
        name: M.string(),
        value: M.number(),
      });

      let preFired = false;
      let postResult: any = null;

      schema.pre("replaceOne", () => {
        preFired = true;
      });
      schema.post("replaceOne", (ctx) => {
        postResult = ctx.result;
      });

      const model = client.model("hooks_replace", schema);
      await model.insertOne({ name: "old", value: 1 });
      await model.replaceOne({ name: "old" }, { name: "new", value: 2 } as any);

      expect(preFired).toBe(true);
      expect(postResult.modifiedCount).toBe(1);
    });
  });

  describe("Hooks with transactions", () => {
    test("hooks fire inside transactions", async () => {
      const schema = M.schema({
        name: M.string(),
        amount: M.number(),
      });

      const hookCalls: string[] = [];
      schema.pre("insertOne", () => {
        hookCalls.push("pre-insert");
      });
      schema.post("insertOne", () => {
        hookCalls.push("post-insert");
      });

      const model = client.model("hooks_txn", schema);

      await client.transaction(async (ctx) => {
        const txModel = ctx.use(model);
        await txModel.insertOne({ name: "in-txn", amount: 100 });
      });

      expect(hookCalls).toEqual(["pre-insert", "post-insert"]);

      const doc = await model.findOne({ name: "in-txn" });
      expect(doc).not.toBeNull();
      expect(doc?.amount).toBe(100);
    });
  });

  describe("Hook on insertMany/createMany", () => {
    test("pre insertMany can modify docs array", async () => {
      const schema = M.schema({
        name: M.string(),
        tagged: M.boolean().default(false),
      });

      schema.pre("insertMany", (ctx) => {
        return {
          docs: ctx.docs.map((d: any) => ({ ...d, tagged: true })),
        };
      });

      const model = client.model("hooks_pre_insertmany", schema);
      await model.insertMany([
        { name: "a", tagged: false },
        { name: "b", tagged: false },
      ] as any[]);

      const all = await model.find({}).exec();
      expect(all.every((d) => d.tagged === true)).toBe(true);
    });

    test("post createMany receives created docs", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      let capturedResult: any[] = [];
      schema.post("createMany", (ctx) => {
        capturedResult = ctx.result as any[];
      });

      const model = client.model("hooks_post_createmany", schema);
      await model.createMany([{ name: "x" }, { name: "y" }]);

      expect(capturedResult.length).toBe(2);
      expect(capturedResult[0].name).toBe("x");
      expect(capturedResult[1].name).toBe("y");
    });
  });

  describe("Schema clone preserves hooks", () => {
    test("hooks survive withTimestamps clone", async () => {
      let hooked = false;
      const baseSchema = M.schema({
        name: M.string(),
      });

      baseSchema.pre("insertOne", () => {
        hooked = true;
      });

      const tsSchema = baseSchema.withTimestamps();

      const model = client.model("hooks_clone_ts", tsSchema);
      await model.insertOne({ name: "test" });
      expect(hooked).toBe(true);
    });
  });

  describe("FindById hooks", () => {
    test("pre/post findById fire correctly", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      let preId: ObjectId | null = null;
      let postResult: any = null;

      schema.pre("findById", (ctx) => {
        preId = ctx._id;
      });
      schema.post("findById", (ctx) => {
        postResult = ctx.result;
      });

      const model = client.model("hooks_findbyid", schema);
      const created = await model.createOne({ name: "lookup" });

      if (created) {
        const createdId = created._id;
        const found = await model.findById(createdId);
        expect((preId as unknown as ObjectId).toString()).toEqual(createdId.toString());
        expect(postResult?.name).toBe("lookup");
        expect(found?.name).toBe("lookup");
      }
    });
  });

  describe("Post hook error propagation", () => {
    test("post hook error propagates to caller", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      schema.post("insertOne", () => {
        throw new Error("post hook failure");
      });

      const model = client.model("hooks_post_error", schema);

      // Operation succeeds (doc inserted) but post hook error propagates
      expect(model.insertOne({ name: "test" })).rejects.toThrow("post hook failure");
    });
  });
});
