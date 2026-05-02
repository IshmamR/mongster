import { afterAll, beforeAll, describe, expect, expectTypeOf, test } from "bun:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongsterClient } from "../src/client";
import type { MongsterModel } from "../src/collection";
import { MongsterSchemaBuilder } from "../src/schema";
import type { InferSchemaType } from "../src/types/types.schema";
import { must } from "./__helper";

const M = new MongsterSchemaBuilder();

let replSet: MongoMemoryReplSet;
let client: MongsterClient;

describe("Aggregation Builder", () => {
  const authorSchema = M.schema({
    name: M.string(),
    team: M.string(),
    active: M.boolean(),
    socials: M.object({ name: M.string(), url: M.string() }).array().default([]),
  });

  let Author!: MongsterModel<"agg_authors", typeof authorSchema>;

  const postSchema = M.schema({
    authorId: M.objectId().ref(() => Author),
    title: M.string(),
    category: M.string(),
    views: M.number(),
    tags: M.string().array(),
    published: M.boolean(),
    banners: M.object({ title: M.string(), img: M.string() }).array().default([]),
  });

  let Post!: MongsterModel<"agg_posts", typeof postSchema>;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    client = new MongsterClient(replSet.getUri());
    await client.connect();

    Author = client.model("agg_authors", authorSchema);
    Post = client.model("agg_posts", postSchema);

    const alice = must(await Author.createOne({ name: "Alice", team: "Core", active: true }));
    const bob = must(await Author.createOne({ name: "Bob", team: "API", active: true }));

    await Post.createMany([
      {
        authorId: alice._id,
        title: "Once upon a space",
        category: "tech",
        views: 100,
        tags: ["ts", "mongo"],
        published: true,
      },
      {
        authorId: alice._id,
        title: "Omelette",
        category: "tech",
        views: 50,
        tags: ["ts"],
        published: true,
      },
      {
        authorId: bob._id,
        title: "Salad",
        category: "food",
        views: 30,
        tags: ["cooking"],
        published: false,
      },
      {
        authorId: bob._id,
        title: "Mongo Tricks",
        category: "tech",
        views: 80,
        tags: ["mongo", "db"],
        published: true,
      },
    ]);
  });

  afterAll(async () => {
    await client.disconnect();
    await replSet.stop();
  });

  test("match + group infers grouped result", async () => {
    const result = await Post.aggregate()
      .match({ published: true })
      .group("$category", {
        totalViews: { $sum: "$views" },
        avgViews: { $avg: "$views" },
        count: { $sum: 1 },
      })
      .sort({ totalViews: -1 })
      .exec();

    expectTypeOf<typeof result>().toEqualTypeOf<
      { _id: string; totalViews: number; avgViews: number; count: number }[]
    >();

    expect(result.length).toBe(1);
    expect(result[0]?._id).toBe("tech");
    expect(result[0]?.totalViews).toBe(230);
    expect(result[0]?.count).toBe(3);
    expect(result[0]?.avgViews).toBeCloseTo(230 / 3, 5);
  });

  test("sort + limit preserve document type", async () => {
    const result = await Post.aggregate()
      .match({ published: true })
      .sort({ views: -1 })
      .limit(2)
      .exec();

    expectTypeOf<typeof result>().toEqualTypeOf<InferSchemaType<typeof postSchema>[]>();
    expect(result.map((post) => post.title)).toEqual(["Once upon a space", "Mongo Tricks"]);
  });

  test("unwind flattens array field for downstream stages", async () => {
    const result = await Post.aggregate()
      .match({ published: true })
      .unwind("$tags")
      .group("$tags", { count: { $sum: 1 } })
      .sort({ count: -1, _id: 1 })
      .exec();

    expectTypeOf<typeof result>().toEqualTypeOf<{ _id: string; count: number }[]>();

    const tagCounts = Object.fromEntries(result.map((item) => [item._id, item.count]));
    expect(tagCounts.ts).toBe(2);
    expect(tagCounts.mongo).toBe(2);
    expect(tagCounts.db).toBe(1);
  });

  test("lookup joins typed foreign documents as arrays", async () => {
    const result = await Post.aggregate()
      .match({ title: "Once upon a space" })
      .lookup({
        from: Author,
        localField: "authorId",
        foreignField: "_id",
        as: "authors",
      })
      .exec();

    expectTypeOf<(typeof result)[number]["title"]>().toEqualTypeOf<string>();
    expectTypeOf<(typeof result)[number]["authors"]>().toEqualTypeOf<
      InferSchemaType<typeof authorSchema>[]
    >();

    expect(result.length).toBe(1);
    expect(result[0]?.authors.length).toBe(1);
    expect(result[0]?.authors[0]?.name).toBe("Alice");
  });

  test("supports chained complex pipelines", async () => {
    const result = await Post.aggregate()
      .match({ published: true })
      .lookup({
        from: Author,
        localField: "authorId",
        foreignField: "_id",
        as: "authors",
      })
      .unwind("$authors")
      .group("$authors.name", {
        totalViews: { $sum: "$views" },
        titles: { $push: "$title" },
      })
      .sort({ totalViews: -1 })
      .exec();

    expectTypeOf<typeof result>().toEqualTypeOf<
      { _id: string; totalViews: number; titles: string[] }[]
    >();

    expect(result.length).toBe(2);
    expect(result[0]?._id).toBe("Alice");
    expect(result[0]?.totalViews).toBe(150);
    expect(result[0]?.titles).toContain("Once upon a space");
  });

  test("count stage returns typed count field", async () => {
    const result = await Post.aggregate().match({ published: true }).count("totalPublished").exec();

    expectTypeOf<typeof result>().toEqualTypeOf<{ totalPublished: number }[]>();
    expect(result[0]?.totalPublished).toBe(3);
  });

  test("project infers included fields, computed fields, and _id exclusion", async () => {
    const result = await Post.aggregate()
      .match({ title: "Once upon a space" })
      .project({
        _id: 0,
        title: 1,
        category: 1,
        slug: "$title",
        metadata: {
          category: "$category",
          published: "$published",
        },
      })
      .exec();

    const post = must(result[0]);
    expectTypeOf(post.title).toEqualTypeOf<string>();
    expectTypeOf(post.category).toEqualTypeOf<string>();
    expectTypeOf(post.slug).toEqualTypeOf<string>();
    expectTypeOf(post.metadata.category).toEqualTypeOf<string>();
    expectTypeOf(post.metadata.published).toEqualTypeOf<boolean>();
    // @ts-expect-error _id excluded by project
    post._id;

    expect("_id" in post).toBe(false);
    expect(post.slug).toBe("Once upon a space");
    expect(post.metadata.category).toBe("tech");
    expect(post.metadata.published).toBe(true);
  });

  test("addFields infers added field types", async () => {
    const result = await Post.aggregate()
      .match({ title: "Mongo Tricks" })
      .addFields({
        slug: "$title",
        metrics: {
          totalViews: "$views",
          isPublished: "$published",
        },
      })
      .exec();

    const post = must(result[0]);
    expectTypeOf(post.title).toEqualTypeOf<string>();
    expectTypeOf(post.slug).toEqualTypeOf<string>();
    expectTypeOf(post.metrics.totalViews).toEqualTypeOf<number>();
    expectTypeOf(post.metrics.isPublished).toEqualTypeOf<boolean>();

    expect(post.slug).toBe("Mongo Tricks");
    expect(post.metrics.totalViews).toBe(80);
    expect(post.metrics.isPublished).toBe(true);
  });

  test("raw stage supports manual output override", async () => {
    const result = await Post.aggregate()
      .raw<{ titleUpper: string }>({
        $project: { _id: 0, titleUpper: { $toUpper: "$title" } },
      })
      .limit(1)
      .exec();

    expectTypeOf<typeof result>().toEqualTypeOf<{ titleUpper: string }[]>();
    expect(result[0]?.titleUpper).toBeDefined();
  });

  test("explain returns MongoDB plan document", async () => {
    const plan = await Post.aggregate().match({ published: true }).explain();
    expect(plan).toBeObject();
  });

  test("aggregate works inside transactions", async () => {
    const result = await client.transaction(async (ctx) => {
      const txAuthor = ctx.use(Author);
      const txPost = ctx.use(Post);

      const txnAuthor = must(
        await txAuthor.createOne({ name: "Txn User", team: "Ops", active: true }),
      );

      await txPost.createOne({
        authorId: txnAuthor._id,
        title: "Txn Only",
        category: "txn",
        views: 25,
        tags: ["txn"],
        published: true,
      });

      return txPost.aggregate().match({ category: "txn" }).count("total").exec();
    });

    expect(result[0]?.total).toBe(1);

    const committed = await Post.aggregate().match({ category: "txn" }).count("total").exec();
    expect(committed[0]?.total).toBe(1);
  });
});
