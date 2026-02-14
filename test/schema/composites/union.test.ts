import { describe, expect, expectTypeOf, test } from "bun:test";
import { SchemaError } from "../../../src";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { InferSchemaInputType } from "../../../src/types/types.schema";

const M = new MongsterSchemaBuilder();

describe("UnionSchema", () => {
  test("should parse values matching one of the schema(s)", () => {
    const schema = M.union(M.string(), M.number());
    expect(schema.parse("hello")).toBe("hello");
    expect(schema.parse(42)).toBe(42);
  });

  test("should reject values not matching any schema", () => {
    const schema = M.union(M.string(), M.number());
    expect(() => schema.parse(true)).toThrow(SchemaError);
    expect(() => schema.parse({})).toThrow(SchemaError);
    expect(() => schema.parse(null)).toThrow(SchemaError);
  });

  test("should get properly type-casted", () => {
    const schema = M.union(
      M.string(),
      M.number(),
      M.boolean(),
      M.object({ name: M.string().optional() }),
    );
    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<
      string | number | boolean | { name?: string | undefined }
    >();
  });

  test("should work with complex schemas", () => {
    const schema = M.union(
      M.object({ type: M.string().enum(["user"] as const), name: M.string() }),
      M.object({
        type: M.string().enum(["admin"] as const),
        permissions: M.array(M.string().enum(["read", "write", "execute"] as const)),
      }),
    );

    type TInput = InferSchemaInputType<typeof schema>;
    const validData1 = { type: "user", name: "Alice" } satisfies TInput;
    const validData2 = { type: "admin", permissions: ["read", "write"] } satisfies TInput;
    expect(schema.parse({ ...validData1 })).toEqual({ ...validData1 });
    expect(schema.parse({ ...validData2 })).toEqual({ ...validData2 });

    expect(() => schema.parse({ type: "user", permissions: [] })).toThrow(SchemaError);
    expect(() => schema.parse({ type: "guest", name: "Bob" })).toThrow(SchemaError);
  });

  test("should work with nullable and optional", () => {
    const nullableSchema = M.union(M.string(), M.number()).nullable();
    type TNullableInput = InferSchemaInputType<typeof nullableSchema>;
    expectTypeOf<TNullableInput>().toEqualTypeOf<string | number | null>();
    expect(nullableSchema.parse(null)).toBeNull();
    expect(nullableSchema.parse("hello")).toBe("hello");
    expect(nullableSchema.parse(42)).toBe(42);

    const optionalSchema = M.union(M.string(), M.number()).optional();
    type TOptionalInput = InferSchemaInputType<typeof optionalSchema>;
    expectTypeOf<TOptionalInput>().toEqualTypeOf<string | number | undefined>();
    expect(optionalSchema.parse(undefined)).toBeUndefined();
    expect(optionalSchema.parse("hello")).toBe("hello");
  });

  test("should handle default and defaultFn values", () => {
    const schema = M.union(M.string(), M.number()).default("default");
    expect(schema.parse(undefined)).toBe("default");
    expect(schema.parse(42)).toBe(42);

    const schemaFn = M.union(M.string(), M.number()).defaultFn(() => 123);
    expect(schemaFn.parse(undefined)).toBe(123);
  });

  test("should validate constraints on matching schema", () => {
    const schema = M.union(M.string().min(5), M.number().max(100));

    expect(schema.parse("hello")).toBe("hello");
    expect(schema.parse(50)).toBe(50);
    expect(() => schema.parse("hi")).toThrow(SchemaError);
    expect(() => schema.parse(150)).toThrow(SchemaError);
  });

  /**
   * `.oneOf()` uses the same UnionSchema under the hood
   */
  test(".oneOf() should work same as union", () => {
    const schema = M.oneOf([M.string(), M.number(), M.boolean()]);

    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<string | number | boolean>();

    expect(schema.parse("hello")).toBe("hello");
    expect(schema.parse(42)).toBe(42);
    expect(schema.parse(true)).toBe(true);
    expect(() => schema.parse({})).toThrow(SchemaError);
  });
});
