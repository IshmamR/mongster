import { describe, expect, expectTypeOf, test } from "bun:test";
import { SchemaError } from "../../../src/error";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { DateSchema } from "../../../src/schema/primitives";

const M = new MongsterSchemaBuilder();

describe("Date schema", () => {
  test("should parse valid dates", () => {
    const schema = M.date();
    const d = new Date();
    expect(schema.parse(d)).toBeInstanceOf(Date);
    expect(schema.parse(d.toISOString())).toBeInstanceOf(Date);
    expect(schema.parse(Date.now())).toBeInstanceOf(Date);
    expect(schema.parse(1672531200000)).toEqual(new Date(1672531200000));
  });

  test("should reject invalid types", () => {
    const schema = M.date();
    expect(() => schema.parse({})).toThrow(SchemaError);
    expect(() => schema.parse(undefined)).toThrow(SchemaError);
  });

  test("should get properly type-casted", () => {
    const schema = M.date();
    expectTypeOf<typeof schema>().toEqualTypeOf<DateSchema>();
  });

  test("should validate min/max constraints", () => {
    const min = new Date("2020-01-01");
    const max = new Date("2030-01-01");
    const schema = M.date().min(min).max(max);
    expect(schema.parse(new Date("2025-01-01"))).toBeInstanceOf(Date);
    expect(() => schema.parse(new Date("2010-01-01"))).toThrow(SchemaError);
    expect(() => schema.parse(new Date("2040-01-01"))).toThrow(SchemaError);
  });

  test("should handle default and defaultFn", () => {
    const defaultDate = new Date("2022-01-01");
    const schema = M.date().default(defaultDate);
    expect(schema.parse(undefined)).toBe(defaultDate);

    const schemaFn = M.date().defaultFn(() => new Date("2023-01-01"));
    expect(schemaFn.parse(undefined)).toEqual(new Date("2023-01-01"));
  });

  test("should detect date strings", () => {
    const schema = M.date();
    expect(schema.parse("2022-01-01")).toEqual(new Date("2022-01-01"));
    expect(() => schema.parse("not-a-date")).toThrow(SchemaError);
  });
});
