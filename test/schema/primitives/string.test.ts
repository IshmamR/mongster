import { describe, expect, expectTypeOf, test } from "bun:test";
import { SchemaError } from "../../../src/error";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { StringSchema } from "../../../src/schema/primitives";

const M = new MongsterSchemaBuilder();

describe("String schema", () => {
  test("should parse valid strings", () => {
    const schema = M.string();
    expect(schema.parse("hello")).toBe("hello");
    expect(schema.parse(" ")).toBe(" ");
    expect(schema.parse("world")).toBe("world");
  });

  test("should reject invalid types", () => {
    const schema = M.string();
    expect(() => schema.parse(42)).toThrow(SchemaError);
    expect(() => schema.parse(true)).toThrow(SchemaError);
    expect(() => schema.parse(null)).toThrow(SchemaError);
    expect(() => schema.parse({})).toThrow(SchemaError);
  });

  test("should get properly type-casted", () => {
    const schema = M.string();
    expectTypeOf<typeof schema>().toEqualTypeOf<StringSchema>();
    const enumSchema = M.string().enum(["a", "b"]);
    expectTypeOf<typeof enumSchema>().toEqualTypeOf<StringSchema<"a" | "b">>();
  });

  test("should validate min length", () => {
    const schema = M.string().min(3);
    expect(schema.parse("hello")).toBe("hello");
    expect(schema.parse("abc")).toBe("abc");
    expect(() => schema.parse("ab")).toThrow(SchemaError);
  });

  test("should validate max length", () => {
    const schema = M.string().max(5);
    expect(schema.parse("hello")).toBe("hello");
    expect(schema.parse("hi")).toBe("hi");
    expect(() => schema.parse("too long")).toThrow(SchemaError);
  });

  test("should validate enum constraint", () => {
    const schema = M.string().enum(["red", "green", "blue"]);
    expect(schema.parse("red")).toBe("red");
    expect(schema.parse("green")).toBe("green");
    expect(() => schema.parse("yellow")).toThrow(SchemaError);
  });

  test("should validate regex pattern", () => {
    const schema = M.string().match(/^[a-z]+$/);
    expect(schema.parse("hello")).toBe("hello");
    expect(() => schema.parse("Hello")).toThrow(SchemaError);
    expect(() => schema.parse("hello123")).toThrow(SchemaError);
  });

  test("should chain validation methods", () => {
    const schema = M.string().min(4).max(10).default("promethewz");
    expect(schema.parse(undefined)).toBe("promethewz");
    expect(schema.parse("mongster")).toBe("mongster");
    expect(() => schema.parse("abc")).toThrow(SchemaError);
    expect(() => schema.parse("abcabcabcabc")).toThrow(SchemaError);
  });
});
