import { describe, expect, expectTypeOf, test } from "bun:test";
import type { ObjectId } from "mongodb";
import { SchemaError } from "../../../src";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { InferSchemaInputType, InferSchemaType } from "../../../src/types/types.schema";

const M = new MongsterSchemaBuilder();

describe("ObjectSchema", () => {
  test("should parse valid objects", () => {
    const schema = M.object({
      name: M.string(),
      age: M.number(),
      active: M.boolean(),
    });

    const data = { name: "Alice", age: 30, active: true };
    expect(schema.parse(data)).toEqual(data);
  });

  test("should reject non-objects", () => {
    const schema = M.object({ name: M.string() });
    expect(() => schema.parse("not an object")).toThrow(SchemaError);
    expect(() => schema.parse(42)).toThrow(SchemaError);
    expect(() => schema.parse(null)).toThrow(SchemaError);
    expect(() => schema.parse([])).toThrow(SchemaError);
  });

  test("should reject embedded MongsterSchema", () => {
    expect(() => M.object({ embedded: M.schema({ name: M.string() }) as never })).toThrowError(
      SchemaError,
    );
  });

  test("should get properly type-casted", () => {
    const schema = M.object({
      id: M.number(),
      name: M.string(),
      isVerified: M.boolean(),
      socials: M.string().array(),
    });
    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<{
      id: number;
      name: string;
      isVerified: boolean;
      socials: string[];
    }>();
  });

  test("should validate all properties", () => {
    const schema = M.object({
      name: M.string(),
      age: M.number().min(0),
    });

    expect(() => schema.parse({ name: "Alice" })).toThrow(
      "age: Expected a number, received undefined",
    );
    expect(() => schema.parse({ age: 30 })).toThrow(
      "name: Expected a string, but received undefined. Field is required.",
    );
    expect(() => schema.parse({ name: 123, age: 30 })).toThrow("name: Expected a string");
    expect(() => schema.parse({ name: "Alice", age: -5 })).toThrow(
      "age: Value must be greater than or equal to 0",
    );
  });

  test("should work with nested objects", () => {
    const schema = M.object({
      user: M.object({
        name: M.string(),
        contact: M.object({
          email: M.string(),
          phone: M.string().optional(),
        }),
      }),
      metadata: M.object({
        created: M.date().default(new Date()),
        tags: M.array(M.string()),
      }),
    });

    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<{
      user: { name: string; contact: { email: string; phone?: string | undefined } };
      metadata: { created?: Date | undefined; tags: string[] };
    }>();

    const validData = {
      user: {
        name: "Alice",
        contact: {
          email: "alice@example.com",
          phone: undefined,
        },
      },
      metadata: {
        created: new Date(),
        tags: ["user", "active"],
      },
    } satisfies TInput;
    expect(schema.parse({ ...validData })).toEqual({ ...validData });

    const invalidData = {
      user: {
        name: "Alice",
        contact: { email: "alice@example.com" },
      },
      metadata: {
        created: "invalid date",
        tags: ["user"],
      },
    };
    expect(() => schema.parse(invalidData)).toThrow(SchemaError);
  });

  test("should handle default and defaultFn values", () => {
    const defaultObj = { name: "Default", count: 0 };
    const schema = M.object({
      name: M.string(),
      count: M.number(),
    }).default(defaultObj);

    expect(schema.parse(undefined)).toEqual(defaultObj);
    expect(schema.parse({ name: "Custom", count: 5 })).toEqual({ name: "Custom", count: 5 });

    const schemaFn = M.object({ name: M.string(), count: M.number() }).defaultFn(() => ({
      name: "Gen",
      count: 1,
    }));
    expect(schemaFn.parse(undefined)).toEqual({ name: "Gen", count: 1 });
  });

  test("should work with optional properties", () => {
    const schema = M.object({
      name: M.string(),
      age: M.number().optional(),
      email: M.string().nullable(),
      active: M.boolean().default(true),
    });

    type TSchemaType = InferSchemaType<typeof schema>;
    expectTypeOf<TSchemaType>().toEqualTypeOf<{
      _id: ObjectId;
      name: string;
      age?: number | undefined;
      email: string | null;
      active: boolean;
    }>();

    type TInputType = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInputType>().toEqualTypeOf<{
      name: string;
      age?: number | undefined;
      email: string | null;
      active?: boolean | undefined;
    }>();

    const validData = {
      name: "Alice",
      age: undefined,
      email: null,
      active: undefined,
    } satisfies TInputType;

    expect(schema.parse({ ...validData })).toEqual({ ...validData, active: true });
  });

  test("should work with arrays of objects", () => {
    const schema = M.object({
      users: M.array(
        M.object({
          id: M.number(),
          name: M.string(),
        }),
      ),
    });

    const validData = {
      users: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
    } satisfies InferSchemaInputType<typeof schema>;

    expect(schema.parse({ ...validData })).toEqual({ ...validData });

    const invalidData = {
      users: [
        { id: 1, name: "Alice" },
        { id: "invalid", name: "Bob" },
      ],
    };
    expect(() => schema.parse(invalidData)).toThrow(SchemaError);
  });
});
