import { describe, expect, expectTypeOf, test } from "bun:test";
import { SchemaError } from "../../../src";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { InferSchemaInputType } from "../../../src/types/types.schema";

const M = new MongsterSchemaBuilder();

describe("TupleSchema", () => {
  test("should parse valid tuples", () => {
    const schema = M.tuple([M.string(), M.number(), M.boolean()]);
    expect(schema.parse(["hello", 42, true])).toEqual(["hello", 42, true]);
  });

  test("should reject non-arrays", () => {
    const schema = M.tuple([M.string(), M.number()]);
    expect(() => schema.parse("not a tuple")).toThrow(SchemaError);
    expect(() => schema.parse({})).toThrow(SchemaError);
    expect(() => schema.parse(null)).toThrow(SchemaError);
  });

  test("should get properly type-casted", () => {
    const schema = M.tuple([M.string(), M.number(), M.boolean()]);
    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<readonly [string, number, boolean]>();
  });

  test("should validate exact length", () => {
    const schema = M.tuple([M.string(), M.number()]);
    expect(() => schema.parse(["hello"])).toThrow(SchemaError);
    expect(() => schema.parse(["hello", 42, true])).toThrow(SchemaError);
    expect(schema.parse(["hello", 42])).toEqual(["hello", 42]);
  });

  test("should validate item types at correct positions", () => {
    const schema = M.tuple([M.string(), M.number(), M.boolean()]);
    expect(() => schema.parse([42, "hello", true])).toThrow(SchemaError);
    expect(() => schema.parse(["hello", "world", true])).toThrow(SchemaError);
    expect(() => schema.parse(["hello", 42, "not boolean"])).toThrow(SchemaError);
  });

  test("should work with complex schemas", () => {
    const schema = M.tuple([
      M.object({ name: M.string() }),
      M.array(M.number()),
      M.string().optional(),
    ]);

    type TInput = InferSchemaInputType<typeof schema>;
    const validData = [{ name: "Alice" }, [1, 2, 3], undefined] satisfies TInput;
    expect(schema.parse([...validData])).toEqual([...validData]);

    const invalidData = [{ name: "Alice" }, ["not", "numbers"], undefined];
    expect(() => schema.parse(invalidData)).toThrow(SchemaError);
  });

  test("should handle default values", () => {
    const defaultTuple = ["default", 0] as const;
    const schema = M.tuple([M.string(), M.number()]).default(defaultTuple);
    expect(schema.parse(undefined)).toEqual(defaultTuple);
    expect(schema.parse(["custom", 42])).toEqual(["custom", 42]);
  });

  test("should handle defaultFn values", () => {
    const schema = M.tuple([M.number(), M.boolean()]).defaultFn(() => [69, false]);
    expect(schema.parse(undefined)).toEqual([69, false]);
    expect(schema.parse([Math.PI, true])).toEqual([Math.PI, true]);
  });

  test("should work with nested tuples", () => {
    const schema = M.tuple([M.string(), M.tuple([M.number(), M.boolean()])]);

    type TInput = InferSchemaInputType<typeof schema>;
    const validData = ["hello", [42, true]] satisfies TInput;
    expect(schema.parse([...validData])).toEqual([...validData]);

    expect(() => schema.parse(["hello", [42, "not boolean"]])).toThrow(SchemaError);
  });

  /**
   * `.fixedArrayOf()` uses the same TupleSchema under the hood
   */
  test(".fixedArrayOf() should work same as tuple", () => {
    const schema = M.fixedArrayOf(M.string(), M.number(), M.boolean());

    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<readonly [string, number, boolean]>();

    expect(schema.parse(["hello", 42, true])).toEqual(["hello", 42, true]);
    expect(() => schema.parse(["hello", 42])).toThrow(SchemaError);
  });
});
