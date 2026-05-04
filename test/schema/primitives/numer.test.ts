import { describe, expect, expectTypeOf, test } from "bun:test";
import { SchemaError } from "../../../src";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { NumberSchema } from "../../../src/schema/primitives";

const M = new MongsterSchemaBuilder();

describe("Number schema", () => {
  const numberSchema = M.number();
  test("should parse valid numbers", () => {
    expect(numberSchema.parse(69)).toBe(69);
    expect(numberSchema.parse(0)).toBe(0);
    expect(numberSchema.parse(-6)).toBe(-6);
    expect(numberSchema.parse(-Infinity)).toBe(-Infinity);
    expect(numberSchema.parse(Math.PI)).toBe(Math.PI);
  });

  test("should reject invalid types", () => {
    expect(() => numberSchema.parse("42")).toThrow(SchemaError);
    expect(() => numberSchema.parse(true)).toThrow(SchemaError);
    expect(() => numberSchema.parse(null)).toThrow(SchemaError);
    expect(() => numberSchema.parse({})).toThrow(SchemaError);
  });

  test("should get properly type-casted", () => {
    const numberSchema = M.number();
    expectTypeOf<typeof numberSchema>().toEqualTypeOf<NumberSchema>();
    const schemaWithEnum = M.number().enum([1, 2]);
    expectTypeOf<typeof schemaWithEnum>().toEqualTypeOf<NumberSchema<1 | 2>>();
  });

  test("should validate min constraints", () => {
    const schema = M.number().min(18);
    expect(schema.parse(18)).toBe(18);
    expect(schema.parse(20)).toBe(20);
    expect(() => schema.parse(17)).toThrow(SchemaError);
  });

  test("should validate max constraints", () => {
    const schema = M.number().max(65);
    expect(schema.parse(0)).toBe(0);
    expect(schema.parse(65)).toBe(65);
    expect(() => schema.parse(100)).toThrow(SchemaError);
  });

  test("should validate enum constraints", () => {
    const schema = M.number().enum([10, 20]);
    expect(schema.parse(10)).toBe(10);
    expect(schema.parse(20)).toBe(20);
    expect(() => schema.parse(30)).toThrow(SchemaError);
  });

  test("should handle default and defaultFn", () => {
    const schema = M.number().default(99);
    expect(schema.parse(undefined)).toBe(99);
    expect(schema.parse(10)).toBe(10);

    const schemaFn = M.number().defaultFn(() => 7);
    expect(schemaFn.parse(undefined)).toBe(7);
    expect(schemaFn.parse(9)).toBe(9);
  });

  test("should chain validation methods", () => {
    const schema = M.number().min(0).max(10).default(5);
    expect(schema.parse(undefined)).toBe(5);
    expect(schema.parse(3)).toBe(3);
    expect(() => schema.parse(-1)).toThrow(SchemaError);
    expect(() => schema.parse(11)).toThrow(SchemaError);
  });
});
