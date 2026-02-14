import { describe, expect, expectTypeOf, test } from "bun:test";
import { randomUUIDv7 } from "bun";
import { ObjectId } from "mongodb";
import { SchemaError } from "../../../src";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { ObjectIdSchema } from "../../../src/schema/bsons";

const M = new MongsterSchemaBuilder();

describe("ObjectIdSchema", () => {
  test("should parse valid ObjectIds", () => {
    const schema = M.objectId();
    const objectId = new ObjectId();
    expect(schema.parse(objectId)).toBe(objectId);
  });

  test("should reject invalid types", () => {
    const schema = M.objectId();
    expect(() => schema.parse("507f1f77bcf86cd799439011")).toThrow(SchemaError);
    expect(() => schema.parse(randomUUIDv7())).toThrow(SchemaError);
    expect(() => schema.parse({})).toThrow(SchemaError);
    expect(() => schema.parse(null)).toThrow(SchemaError);
  });

  test("should get properly type-casted", () => {
    const schema = M.objectId();
    expectTypeOf<typeof schema>().toEqualTypeOf<ObjectIdSchema>();
  });

  test("should handle default generation", () => {
    const schema = M.objectId().default("generate");
    const result = schema.parse(undefined);
    expect(result).toBeInstanceOf(ObjectId);
  });

  test("should handle default ObjectId", () => {
    const defaultId = new ObjectId();
    const schema = M.objectId().default(defaultId);
    expect(schema.parse(undefined)).toBe(defaultId);
  });

  test("should handle defaultFn ObjectId", () => {
    const def = new ObjectId();
    const schema = M.objectId().defaultFn(() => def);
    expect(schema.parse(undefined)).toBe(def);
  });
});
