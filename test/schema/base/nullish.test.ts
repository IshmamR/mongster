import { describe, expect, expectTypeOf, test } from "bun:test";
import { SchemaError } from "../../../src";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { InferSchemaInputType } from "../../../src/types/types.schema";

const M = new MongsterSchemaBuilder();

describe("OptionalSchema", () => {
  test("should allow undefined values", () => {
    const schema = M.string().optional();
    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.parse("hello")).toBe("hello");
  });

  test("should validate inner schema when value is present", () => {
    const schema = M.number().min(10).optional();
    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.parse(15)).toBe(15);
    expect(() => schema.parse(5)).toThrow(SchemaError);
  });

  test("should get properly type-casted", () => {
    const schema = M.boolean().optional();
    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<boolean | undefined>();
  });

  test("should work with complex schemas", () => {
    const schema = M.object({
      name: M.string(),
      age: M.number(),
    }).optional();

    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<{ name: string; age: number } | undefined>();

    expect(schema.parse(undefined)).toBeUndefined();

    const validData = { name: "John", age: 30 } satisfies TInput;
    expect(schema.parse({ ...validData })).toEqual({ ...validData });

    expect(() => schema.parse({ name: "John" })).toThrow(SchemaError);
  });
});

describe("NullableSchema", () => {
  test("should allow null values", () => {
    const schema = M.string().nullable();
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse("hello")).toBe("hello");
  });

  test("should validate inner schema when value is not null", () => {
    const schema = M.number().max(100).nullable();
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse(50)).toBe(50);
    expect(() => schema.parse(150)).toThrow(SchemaError);
  });

  test("should get properly type-casted", () => {
    const schema = M.boolean().nullable();
    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<boolean | null>();
  });

  test("should work with complex schemas", () => {
    const schema = M.array(M.string()).nullable();

    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<string[] | null>();

    expect(schema.parse(null)).toBeNull();

    const validArr = ["a", "b"] satisfies TInput;
    expect(schema.parse([...validArr])).toEqual([...validArr]);

    expect(() => schema.parse([1, 2])).toThrow(SchemaError);
  });
});

describe("Chaining Optional and Nullable", () => {
  test("should allow both null and undefined", () => {
    const schema = M.string().enum(["mongster", "promethewz"]).nullable().optional();

    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<"mongster" | "promethewz" | null | undefined>();

    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse("mongster")).toBe("mongster");
    expect(() => schema.parse("hello")).toThrow(SchemaError);
  });

  test("should work in the reverse order too", () => {
    const schema = M.string().enum(["mongster", "promethewz"]).optional().nullable();

    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<"mongster" | "promethewz" | null | undefined>();

    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse("promethewz")).toBe("promethewz");
    expect(() => schema.parse("hello")).toThrow(SchemaError);
  });
});
