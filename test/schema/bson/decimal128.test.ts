import { describe, expect, expectTypeOf, test } from "bun:test";
import { Decimal128 } from "mongodb";
import { SchemaError } from "../../../src";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { Decimal128Schema } from "../../../src/schema/bsons";

const M = new MongsterSchemaBuilder();

describe("Decimal128Schema", () => {
  test("should parse valid Decimal128", () => {
    const schema = M.decimal();
    const decimal = Decimal128.fromString("123.456");
    expect(schema.parse(decimal)).toBe(decimal);
  });

  test("should reject invalid types", () => {
    const schema = M.decimal();
    expect(() => schema.parse(123.456)).toThrow(SchemaError);
    expect(() => schema.parse("123.456")).toThrow(SchemaError);
    expect(() => schema.parse({})).toThrow(SchemaError);
  });

  test("should get properly type-casted", () => {
    const schema = M.decimal();
    expectTypeOf<typeof schema>().toEqualTypeOf<Decimal128Schema>();
  });

  test("should handle default values", () => {
    const defaultDecimal = Decimal128.fromString("100.00");
    const schema = M.decimal().default(defaultDecimal);
    expect(schema.parse(undefined)).toBe(defaultDecimal);
  });

  test("should handle default and defaultFn", () => {
    const d = Decimal128.fromString("200.50");

    const schema = M.decimal().default(d);
    expect(schema.parse(undefined)).toBe(d);

    const schemaFn = M.decimal().defaultFn(() => d);
    expect(schemaFn.parse(undefined)).toBe(d);
  });
});
