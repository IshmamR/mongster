import { afterAll, beforeAll, describe, expect, expectTypeOf, test } from "bun:test";
import { ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongsterClient } from "../src/client";
import type { MongsterModel } from "../src/collection";
import { MongsterSchemaBuilder } from "../src/schema";
import { must } from "./__helper";

const M = new MongsterSchemaBuilder();

let replSet: MongoMemoryReplSet;
let client: MongsterClient;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = new MongsterClient(replSet.getUri());
  await client.connect();
});

afterAll(async () => {
  await client.disconnect();
  await replSet.stop();
});

describe("Population", () => {
  const postSchema = M.schema({
    title: M.string(),
    content: M.string(),
    banners: M.object({ title: M.string(), img: M.string() }).array().default([]),
  });

  let Post!: MongsterModel<"pop_posts", typeof postSchema>;

  const userSchema = M.schema({
    name: M.string(),
    age: M.number(),
    favoritePost: M.objectId().ref(() => Post),
  });

  let User!: MongsterModel<"pop_users", typeof userSchema>;

  const commentSchema = M.schema({
    text: M.string(),
    author: M.objectId().ref(() => User),
    post: M.objectId().ref(() => Post),
  });

  let Comment!: MongsterModel<"pop_comments", typeof commentSchema>;

  let postId: ObjectId;
  let userId: ObjectId;

  beforeAll(async () => {
    Post = client.model("pop_posts", postSchema);
    User = client.model("pop_users", userSchema);
    Comment = client.model("pop_comments", commentSchema);

    const post = must(await Post.createOne({ title: "Hello World", content: "First post" }));
    postId = post._id;

    const user = must(await User.createOne({ name: "Alice", age: 30, favoritePost: postId }));
    userId = user._id;

    await User.createOne({ name: "Orphan", age: 25, favoritePost: new ObjectId() });
  });

  describe("find().populate()", () => {
    test("replaces ObjectId with referenced document", async () => {
      const users = await User.find({ name: "Alice" }).populate("favoritePost").exec();
      expect(users.length).toBe(1);

      const user = users[0];
      const favoritePost = must(user?.favoritePost);
      expect(favoritePost).not.toBeInstanceOf(ObjectId);
      expect(favoritePost.title).toBe("Hello World");
      expect(favoritePost.content).toBe("First post");
      expect(favoritePost._id).toEqual(postId);
    });

    test("returns null for non-matching ref", async () => {
      const users = await User.find({ name: "Orphan" }).populate("favoritePost").exec();
      expect(users.length).toBe(1);
      expect(users[0]?.favoritePost).toBeNull();
    });

    test("works with multiple documents", async () => {
      const users = await User.find({}).populate("favoritePost").sort({ name: 1 }).exec();
      expect(users.length).toBeGreaterThanOrEqual(2);

      const alice = must(users.find((u) => u.name === "Alice"));
      const alicePost = must(alice.favoritePost);
      expect(alicePost.title).toBe("Hello World");

      const orphan = must(users.find((u) => u.name === "Orphan"));
      expect(orphan.favoritePost).toBeNull();
    });

    test("works with sort/limit/skip", async () => {
      const users = await User.find({}).populate("favoritePost").sort({ name: 1 }).limit(1).exec();

      expect(users.length).toBe(1);
      expect(users[0]?.name).toBe("Alice");
      expect(must(users[0]?.favoritePost).title).toBe("Hello World");
    });

    test("populate with select limits returned fields", async () => {
      const users = await User.find({ name: "Alice" })
        .populate("favoritePost", { select: ["title"] })
        .exec();

      const post = must(users[0]?.favoritePost);
      expect(post.title).toBe("Hello World");
      expect(post._id).toBeDefined();
      expect("content" in post).toBe(false);
    });

    test("populate with empty select returns only _id", async () => {
      const users = await User.find({ name: "Alice" })
        .populate("favoritePost", { select: [] })
        .exec();

      const post = must(users[0]?.favoritePost);
      expectTypeOf<typeof post>().toEqualTypeOf<{ _id: ObjectId }>();
      expect(post._id).toBeDefined();
      expect("title" in post).toBe(false);
      expect("content" in post).toBe(false);
    });

    test("populate with select can exclude _id", async () => {
      const users = await User.find({ name: "Alice" })
        .populate("favoritePost", { select: ["title"], excludeId: true })
        .exec();

      const post = must(users[0]?.favoritePost);
      expect(post.title).toBe("Hello World");
      expect("_id" in post).toBe(false);
    });

    test("find without populate returns ObjectId", async () => {
      const users = await User.find({ name: "Alice" }).exec();
      expect(users[0]?.favoritePost).toBeInstanceOf(ObjectId);
    });

    test("find without populate via await (thenable) returns ObjectId", async () => {
      const users = await User.find({ name: "Alice" });
      expect(users[0]?.favoritePost).toBeInstanceOf(ObjectId);
    });
  });

  describe("findOne().populate()", () => {
    test("replaces ObjectId with referenced document", async () => {
      const user = await User.findOne({ name: "Alice" }).populate("favoritePost");
      const favoritePost = must(user?.favoritePost);
      expect(favoritePost).not.toBeInstanceOf(ObjectId);
      expect(favoritePost.title).toBe("Hello World");
    });

    test("returns null when no doc found", async () => {
      const user = await User.findOne({ name: "NonExistent" }).populate("favoritePost");
      expect(user).toBeNull();
    });

    test("returns null for non-matching ref", async () => {
      const user = await User.findOne({ name: "Orphan" }).populate("favoritePost");
      expect(user?.favoritePost).toBeNull();
    });

    test("findOne without populate works as before", async () => {
      const user = must(await User.findOne({ name: "Alice" }));
      expect(user.favoritePost).toBeInstanceOf(ObjectId);
    });

    test("populate with select on findOne", async () => {
      const user = await User.findOne({ name: "Alice" }).populate("favoritePost", {
        select: ["title"],
      });
      const favoritePost = must(user?.favoritePost);
      expect(favoritePost.title).toBe("Hello World");
      expect("content" in favoritePost).toBe(false);
    });
  });

  describe("findById().populate()", () => {
    test("replaces ObjectId with referenced document", async () => {
      const user = await User.findById(userId).populate("favoritePost");
      expect(user?.favoritePost?.title).toBe("Hello World");
    });

    test("findById without populate works as before", async () => {
      const user = await User.findById(userId);
      expect(user?.favoritePost).toBeInstanceOf(ObjectId);
    });

    test("findById returns null for non-existent id", async () => {
      const user = await User.findById(new ObjectId()).populate("favoritePost");
      expect(user).toBeNull();
    });
  });

  describe("multiple populates", () => {
    test("chain populate on multiple ref fields", async () => {
      await Comment.createOne({
        text: "Great post!",
        author: userId,
        post: postId,
      });

      const comments = await Comment.find({ text: "Great post!" })
        .populate("author")
        .populate("post");

      expect(comments.length).toBeGreaterThan(0);
      const comment = comments[0];
      const author = must(comment?.author);
      const post = must(comment?.post);
      expect(author.name).toBe("Alice");
      expect(post.title).toBe("Hello World");
    });

    test("multiple populates on findOne", async () => {
      const comment = await Comment.findOne({ text: "Great post!" })
        .populate("author")
        .populate("post");

      expect(comment?.author?.name).toBe("Alice");
      expect(comment?.post?.title).toBe("Hello World");
    });
  });

  describe("hooks integration", () => {
    test("pre/post find hooks fire with populate", async () => {
      const tagSchema = M.schema({ label: M.string() });
      let Tag!: MongsterModel<"pop_tags", typeof tagSchema>;

      const itemSchema = M.schema({
        name: M.string(),
        tag: M.objectId().ref(() => Tag),
      });

      const hookCalls: string[] = [];
      itemSchema.pre("find", () => {
        hookCalls.push("pre-find");
      });
      itemSchema.post("find", () => {
        hookCalls.push("post-find");
      });

      Tag = client.model("pop_tags", tagSchema);
      const Item = client.model("pop_items", itemSchema);

      const tag = must(await Tag.createOne({ label: "important" }));
      await Item.createOne({ name: "item1", tag: tag._id });

      const items = await Item.find({}).populate("tag").exec();
      expect(items[0]?.tag?.label).toBe("important");
      expect(hookCalls).toEqual(["pre-find", "post-find"]);
    });

    test("pre findOne hooks fire with populate", async () => {
      const catSchema = M.schema({ breed: M.string() });
      let Cat!: MongsterModel<"pop_cats", typeof catSchema>;

      const ownerSchema = M.schema({
        name: M.string(),
        cat: M.objectId().ref(() => Cat),
      });

      let preFired = false;
      ownerSchema.pre("findOne", () => {
        preFired = true;
      });

      Cat = client.model("pop_cats", catSchema);
      const Owner = client.model("pop_owners", ownerSchema);

      const cat = must(await Cat.createOne({ breed: "Persian" }));
      await Owner.createOne({ name: "Bob", cat: cat._id });

      const owner = await Owner.findOne({ name: "Bob" }).populate("cat");
      expect(owner?.cat?.breed).toBe("Persian");
      expect(preFired).toBe(true);
    });

    test("pre find hook can modify filter with populate", async () => {
      const labelSchema = M.schema({ text: M.string() });
      let Label!: MongsterModel<"pop_labels", typeof labelSchema>;

      const widgetSchema = M.schema({
        name: M.string(),
        active: M.boolean(),
        label: M.objectId().ref(() => Label),
      });

      widgetSchema.pre("find", (ctx) => {
        return { filter: { ...ctx.filter, active: true } };
      });

      Label = client.model("pop_labels", labelSchema);
      const Widget = client.model("pop_widgets", widgetSchema);

      const label = must(await Label.createOne({ text: "v1" }));
      await Widget.createOne({ name: "visible", active: true, label: label._id });
      await Widget.createOne({ name: "hidden", active: false, label: label._id });

      const widgets = await Widget.find({}).populate("label").exec();
      expect(widgets.length).toBe(1);
      expect(widgets[0]?.name).toBe("visible");
      expect(must(widgets[0]?.label).text).toBe("v1");
    });
  });

  describe("error handling", () => {
    test("populate on non-ref field throws", async () => {
      // @ts-expect-error populate only accepts ref fields
      await expect(User.find({}).populate("name").exec()).rejects.toThrow();
    });

    test("populate on non-existent field throws", async () => {
      // @ts-expect-error populate only accepts known ref fields
      await expect(User.find({}).populate("nonExistent").exec()).rejects.toThrow();
    });
  });

  describe("transactions", () => {
    test("populate works inside transactions", async () => {
      const result = await client.transaction(async (ctx) => {
        const txPost = ctx.use(Post);
        const txUser = ctx.use(User);

        const post = must(await txPost.createOne({ title: "Txn Post", content: "In transaction" }));
        await txUser.createOne({ name: "TxnUser", age: 20, favoritePost: post._id });

        const users = await txUser.find({ name: "TxnUser" }).populate("favoritePost").exec();
        return users;
      });

      expect(result.length).toBe(1);
      expect(must(must(result[0]).favoritePost).title).toBe("Txn Post");

      const committed = await User.findOne({ name: "TxnUser" }).populate("favoritePost");
      expect(committed?.favoritePost?.title).toBe("Txn Post");
    });

    test("populate data rolls back on transaction failure", async () => {
      const uniqueName = `rollback_${Date.now()}`;

      try {
        await client.transaction(async (ctx) => {
          const txPost = ctx.use(Post);
          const txUser = ctx.use(User);

          const post = must(
            await txPost.createOne({ title: "Rollback Post", content: "Will rollback" }),
          );
          await txUser.createOne({ name: uniqueName, age: 99, favoritePost: post._id });

          throw new Error("force rollback");
        });
      } catch {
        // expected
      }

      // not a thing should be committed
      const user = await User.findOne({ name: uniqueName });
      expect(user).toBeNull();
    });
  });

  describe("ref declaration", () => {
    test("ref field still stores ObjectId in DB", async () => {
      const collection = User.getCollection();
      const rawDoc = must(await collection.findOne({ name: "Alice" }));
      expect(rawDoc.favoritePost).toBeInstanceOf(ObjectId);
    });

    test("ref field parses as ObjectId on insert", async () => {
      const anotherPost = must(await Post.createOne({ title: "Another", content: "..." }));
      const user = must(
        await User.createOne({
          name: "Ref Test",
          age: 20,
          favoritePost: anotherPost._id,
        }),
      );
      // createOne returns the raw doc with ObjectId
      expect(user.favoritePost).toBeInstanceOf(ObjectId);
    });
  });

  // array refs are not supported rn. im tired
  describe("array refs (v1 limitation)", () => {
    test("array of ObjectIds is not populatable in v1", async () => {
      const tagSchema = M.schema({ label: M.string() });
      const ArrTag = client.model("pop_arr_tags", tagSchema);

      const articleSchema = M.schema({
        title: M.string(),
        tagIds: M.objectId().array(),
      });

      const Article = client.model("pop_articles", articleSchema);

      const t1 = must(await ArrTag.createOne({ label: "ts" }));
      const t2 = must(await ArrTag.createOne({ label: "mongo" }));
      await Article.createOne({ title: "Blog", tagIds: [t1._id, t2._id] });

      // populate on non-ref field should throw
      // @ts-expect-error populate only accepts ref fields
      await expect(Article.find({}).populate("tagIds").exec()).rejects.toThrow();
    });
  });

  describe("nested fields", () => {
    test("should populate nested fields", async () => {
      const authorSchema = M.schema({
        name: M.string(),
        socials: M.object({
          github: M.string(),
          linkedin: M.string(),
        }),
      });
      const Author = client.model("authors", authorSchema);

      const postSchema = M.schema({
        authorId: M.objectId().ref(() => Author),
        title: M.string(),
      });
      const Post = client.model("posts", postSchema);

      const author = must(
        await Author.createOne({
          name: "Promethewz",
          socials: {
            github: "https://github.com/IshmamR",
            linkedin: "https://linkedin.com/ishmam-r",
          },
        }),
      );

      await Post.createMany([
        { authorId: author._id, title: "Once upon a space" },
        { authorId: author._id, title: "Omelette" },
      ]);

      const result = await Post.find({}).populate("authorId", {
        select: ["socials.github"],
        excludeId: true,
      });

      expect(result).toBeArray();
      expectTypeOf<(typeof result)[number]["_id"]>().toEqualTypeOf<ObjectId>();
      expectTypeOf<(typeof result)[number]["authorId"]>().toEqualTypeOf<{
        socials: {
          github: string;
        };
      } | null>();

      const populatedAuthor = must(result[0]?.authorId);
      expect(populatedAuthor.socials.github).toBe("https://github.com/IshmamR");
      expect("_id" in populatedAuthor).toBe(false);
      expect("name" in populatedAuthor).toBe(false);
    });
  });
});
