import { describe, expect, expectTypeOf, test } from "bun:test";
import { Decimal128, ObjectId } from "mongodb";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { InferSchemaInputType } from "../../../src/types/types.schema";

const M = new MongsterSchemaBuilder();

describe("MongsterSchema", () => {
  test("should parse valid root documents", () => {
    const schema = M.schema({
      _id: M.objectId(),
      name: M.string(),
      email: M.string(),
      age: M.number().min(0),
      active: M.boolean().default(true),
    });

    const data = {
      _id: new ObjectId(),
      name: "Alice",
      email: "alice@example.com",
      age: 30,
      active: undefined,
    };

    const result = schema.parse(data);
    expect(result.active).toBe(true);
    expect(result.name).toBe("Alice");
  });

  test("should work with timestamps", () => {
    const schema = M.schema({
      name: M.string(),
      description: M.string().optional(),
    }).withTimestamps();

    const data = {
      name: "Test Document",
      description: undefined,
    };

    expect(() => schema.parse(data)).not.toThrow();
    const parsed = schema.parse(data);
    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect(parsed.updatedAt).toBeInstanceOf(Date);
  });

  test("should allow disabling createdAt and renaming updatedAt", () => {
    const schema = M.schema({
      name: M.string(),
    }).withTimestamps({ createdAt: false, updatedAt: "uAt" });

    const parsed = schema.parse({ name: "hello" });

    expect((parsed as any).createdAt).toBeUndefined();
    expect((parsed as any).updatedAt).toBeUndefined();
    expect(parsed.uAt).toBeInstanceOf(Date);
  });

  test("should reject embedded MongsterSchema", () => {
    expect(() => M.schema({ embedded: M.schema({ name: M.string() }) as any })).toThrowError(
      "MongsterSchema cannot be embedded",
    );
  });

  test("should infer optional _id for schema input", () => {
    const schema = M.schema({
      name: M.string(),
    });

    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<{
      _id?: ObjectId | undefined;
      name: string;
    }>();

    const withId = {
      _id: new ObjectId(),
      name: "typed-user",
    } satisfies TInput;
    expect(withId._id).toBeInstanceOf(ObjectId);

    const withoutId = {
      name: "typed-user-no-id",
    } satisfies TInput;
    expect(withoutId.name).toBe("typed-user-no-id");
  });

  test("should handle complex nested schemas", () => {
    const schema = M.schema({
      _id: M.objectId().default("generate"),
      user: M.object({
        profile: M.object({
          name: M.string(),
          avatar: M.string().optional(),
        }),
        settings: M.object({
          theme: M.string().enum(["light", "dark"]).default("light"),
          notifications: M.boolean().default(true),
        }),
      }),
      posts: M.array(
        M.object({
          id: M.string(),
          title: M.string(),
          content: M.string(),
          tags: M.array(M.string()).default([]),
          metadata: M.object({
            views: M.number().default(0),
            likes: M.number().default(0),
            created: M.date(),
          }),
        }),
      ),
      status: M.union(
        M.string().enum(["active", "inactive", "suspended"]),
        M.object({
          type: M.string().enum(["custom"]),
          reason: M.string(),
        }),
      ),
    });

    const data = {
      _id: undefined,
      user: {
        profile: {
          name: "John Doe",
          avatar: undefined,
        },
        settings: {
          theme: undefined,
          notifications: false,
        },
      },
      posts: [
        {
          id: "post1",
          title: "My First Post",
          content: "Hello world!",
          tags: undefined,
          metadata: {
            views: undefined,
            likes: undefined,
            created: new Date("2025-01-01"),
          },
        },
      ],
      status: "active",
    };

    const result = schema.parse(data);
    expect(result._id).toBeInstanceOf(ObjectId);
    expect(result.user.settings.theme).toBe("light");
    expect(result.posts[0]?.tags).toEqual([]);
    expect(result.posts[0]?.metadata.views).toBe(0);
  });

  test("should validate all required fields", () => {
    const schema = M.schema({
      name: M.string(),
      email: M.string(),
      age: M.number(),
    });

    expect(() =>
      schema.parse({
        name: "Alice",
        email: "alice@example.com",
      }),
    ).toThrow("age: Expected a number, received undefined");

    expect(() =>
      schema.parse({
        name: "Alice",
        age: 30,
      }),
    ).toThrow("email: Expected a string, but received undefined. Field is required.");
  });

  test("should reject non-objects", () => {
    const schema = M.schema({
      name: M.string(),
    });

    expect(() => schema.parse("not an object")).toThrow("Expected an object");
    expect(() => schema.parse([])).toThrow("Expected an object, but received an array");
    expect(() => schema.parse(null)).toThrow("Expected an object");
  });

  test("should work with all schema types", () => {
    const schema = M.schema({
      _id: M.objectId(),
      string_field: M.string(),
      number_field: M.number(),
      boolean_field: M.boolean(),
      date_field: M.date(),
      decimal_field: M.decimal(),
      binary_field: M.binary(),
      array_field: M.array(M.string()),
      tuple_field: M.tuple([M.string(), M.number()]),
      union_field: M.union(M.string(), M.number()),
      object_field: M.object({
        nested: M.string(),
      }),
      optional_field: M.string().optional(),
      nullable_field: M.string().nullable(),
    });

    const data = {
      _id: new ObjectId(),
      string_field: "test",
      number_field: 42,
      boolean_field: true,
      date_field: new Date(),
      decimal_field: Decimal128.fromString("123.45"),
      binary_field: Buffer.from("test"),
      array_field: ["a", "b", "c"],
      tuple_field: ["hello", 123] as [string, number],
      union_field: "string value",
      object_field: {
        nested: "nested value",
      },
      optional_field: undefined,
      nullable_field: null,
    };

    expect(() => schema.parse(data)).not.toThrow();
  });
});
