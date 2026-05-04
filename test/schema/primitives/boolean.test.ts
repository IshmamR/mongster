import { describe, expect, expectTypeOf, test } from "bun:test";
import { SchemaError } from "../../../src/error";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { BooleanSchema } from "../../../src/schema/primitives";

const M = new MongsterSchemaBuilder();

describe("Boolean schema", () => {
  test("should parse valid booleans", () => {
    const schema = M.boolean();
    expect(schema.parse(true)).toBe(true);
    expect(schema.parse(false)).toBe(false);
  });

  test("should reject invalid types", () => {
    const schema = M.boolean();
    expect(() => schema.parse(1)).toThrow(SchemaError);
    expect(() => schema.parse("true")).toThrow(SchemaError);
    expect(() => schema.parse(null)).toThrow(SchemaError);
  });

  test("should get properly type-casted", () => {
    const schema = M.boolean();
    expectTypeOf<typeof schema>().toEqualTypeOf<BooleanSchema>();
  });

  test("should handle default values", () => {
    const schema = M.boolean().default(true);
    expect(schema.parse(undefined)).toBe(true);
    expect(schema.parse(false)).toBe(false);
  });

  test("should handle defaultFn values", () => {
    const schema = M.boolean().defaultFn(() => false);
    expect(schema.parse(undefined)).toBe(false);
    expect(schema.parse(true)).toBe(true);
  });
});
