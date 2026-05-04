import { describe, expect, expectTypeOf, test } from "bun:test";
import { SchemaError } from "../../../src";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { InferSchemaInputType } from "../../../src/types/types.schema";

const M = new MongsterSchemaBuilder();

describe("ArraySchema", () => {
  test("should parse valid arrays", () => {
    const strArrSchema = M.array(M.string());
    expect(strArrSchema.parse(["hello", "world"])).toEqual(["hello", "world"]);
    expect(strArrSchema.parse([])).toEqual([]);

    const numArrSchema = M.array(M.number());
    expect(numArrSchema.parse([6, 7])).toEqual([6, 7]);
    const numbers = [Math.PI, Math.E, Math.SQRT1_2];
    expect(numArrSchema.parse([...numbers])).toEqual([...numbers]);
  });

  test("should reject non-arrays", () => {
    const schema = M.array(M.string());
    expect(() => schema.parse("not an array")).toThrow(SchemaError);
    expect(() => schema.parse({})).toThrow(SchemaError);
    expect(() => schema.parse(null)).toThrow(SchemaError);
  });

  test("should validate item types", () => {
    const schema = M.array(M.number());
    expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3]);
    expect(() => schema.parse([1, "2", 3])).toThrow(SchemaError);
    expect(() => schema.parse([1, 2, "three"])).toThrow(SchemaError);
  });

  test("should get properly type-casted", () => {
    const schema = M.array(M.number());
    expectTypeOf<InferSchemaInputType<typeof schema>>().toEqualTypeOf<number[]>();
  });

  test("should validate min length", () => {
    const schema = M.array(M.string()).min(2);
    expect(schema.parse(["a", "b"])).toEqual(["a", "b"]);
    expect(schema.parse(["a", "b", "c"])).toEqual(["a", "b", "c"]);
    expect(() => schema.parse([])).toThrow(SchemaError);
    expect(() => schema.parse(["a"])).toThrow(SchemaError);
  });

  test("should validate max length", () => {
    const schema = M.array(M.string()).max(2);
    expect(schema.parse([])).toEqual([]);
    expect(schema.parse(["a"])).toEqual(["a"]);
    expect(schema.parse(["a", "b"])).toEqual(["a", "b"]);
    expect(() => schema.parse(["a", "b", "c"])).toThrow(SchemaError);
  });

  test("should handle default values", () => {
    const schema = M.array(M.string()).default(["default"]);
    expect(schema.parse(undefined)).toEqual(["default"]);
    expect(schema.parse(["custom"])).toEqual(["custom"]);
  });

  test("should handle defaultFn values", () => {
    const schema = M.array(M.string()).defaultFn(() => ["a", "b"]);
    expect(schema.parse(undefined)).toEqual(["a", "b"]);
    expect(schema.parse(["x"])).toEqual(["x"]);
  });

  test("should work with complex item schemas", () => {
    const schema = M.array(
      M.object({
        id: M.number(),
        name: M.string(),
      }),
    );

    const validData = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ] satisfies InferSchemaInputType<typeof schema>;
    expect(schema.parse(validData)).toEqual(validData);

    expect(() => schema.parse([{ id: 1 }])).toThrow(SchemaError);
    expect(() => schema.parse([{ name: "Alice" }])).toThrow(SchemaError);
  });

  test("should work with nested arrays", () => {
    const schema = M.array(M.array(M.number()));
    expect(
      schema.parse([
        [1, 2],
        [3, 4],
      ]),
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(() =>
      schema.parse([
        [1, "2"],
        [3, 4],
      ]),
    ).toThrow(SchemaError);
  });

  test("should chain validations", () => {
    const schema = M.array(M.number().min(0)).min(1).max(5).default([1, 2, 3]);
    expect(schema.parse(undefined)).toEqual([1, 2, 3]);
    expect(schema.parse([1, 2])).toEqual([1, 2]);
    expect(() => schema.parse([])).toThrow(SchemaError);
    expect(() => schema.parse([1, 2, 3, 4, 5, 6])).toThrow(SchemaError);
    expect(() => schema.parse([1, -1, 3])).toThrow(SchemaError);
  });

  ///
  /// Array method on other schema
  ///

  test("should create array from primitive schema", () => {
    const schema = M.string().array();
    expectTypeOf<InferSchemaInputType<typeof schema>>().toEqualTypeOf<string[]>();
    expect(schema.parse(["hello", "world"])).toEqual(["hello", "world"]);
    expect(() => schema.parse([1, 2])).toThrow(SchemaError);
  });

  test("should create array from complex schema", () => {
    const schema = M.object({ name: M.string() }).array();
    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<{ name: string }[]>();
    const values = [{ name: "Alice" }, { name: "Bob" }] satisfies TInput;
    expect(schema.parse([...values])).toEqual([...values]);
  });
});
