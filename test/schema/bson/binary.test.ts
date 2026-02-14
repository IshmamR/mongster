import { describe, expect, expectTypeOf, test } from "bun:test";
import { Binary } from "mongodb";
import { SchemaError } from "../../../src";
import { MongsterSchemaBuilder } from "../../../src/schema";
import type { BinarySchema } from "../../../src/schema/bsons";

const M = new MongsterSchemaBuilder();

describe("BinarySchema", () => {
  test("should parse Buffer", () => {
    const schema = M.binary();
    const buffer = Buffer.from("hello");
    const result = schema.parse(buffer);
    expect(result).toBeInstanceOf(Binary);
    expect(result.buffer).toEqual(buffer);
  });

  test("should parse Uint8Array", () => {
    const schema = M.binary();
    const uint8Array = new Uint8Array([1, 2, 3, 4]);
    const result = schema.parse(uint8Array);
    expect(result).toBeInstanceOf(Binary);
    expect(result.buffer.toBase64()).toEqual(uint8Array.toBase64());
  });

  test("should parse Binary", () => {
    const schema = M.binary();
    const binary = new Binary(Buffer.from("test"));
    const result = schema.parse(binary);
    expect(result).toEqual(binary);
  });

  test("should parse number array", () => {
    const schema = M.binary();
    const numberArray = [72, 101, 108, 108, 111];
    const result = schema.parse(numberArray);
    expect(result).toBeInstanceOf(Binary);
    expect(result.buffer.toBase64()).toEqual(new Uint8Array(numberArray).toBase64());
  });

  test("should reject invalid types", () => {
    const schema = M.binary();
    expect(() => schema.parse("hello")).toThrow(SchemaError);
    expect(() => schema.parse(123)).toThrow(SchemaError);
    expect(() => schema.parse([256])).toThrow(SchemaError); // number range is [0, 255]
  });

  test("should get properly type-casted", () => {
    const schema = M.binary();
    expectTypeOf<typeof schema>().toEqualTypeOf<BinarySchema>();
  });

  test("should validate min length", () => {
    const schema = M.binary().min(5);
    expect(() => schema.parse(Buffer.from("hi"))).toThrow(SchemaError);
    expect(schema.parse(Buffer.from("hello"))).toBeInstanceOf(Binary);
  });

  test("should validate max length", () => {
    const schema = M.binary().max(3);
    expect(() => schema.parse(Buffer.from("hello"))).toThrow(SchemaError);
    expect(schema.parse(Buffer.from("hi"))).toBeInstanceOf(Binary);
  });

  test("should handle BSON subtypes", () => {
    const schema = M.binary().bsonSubType(Binary.SUBTYPE_UUID);
    const result = schema.parse(Buffer.from("test"));
    expect(result.sub_type).toBe(Binary.SUBTYPE_UUID);
  });

  test("should validate Binary subtype", () => {
    const schema = M.binary().bsonSubType(Binary.SUBTYPE_UUID);
    const binary = new Binary(Buffer.from("test"), Binary.SUBTYPE_MD5);
    expect(() => schema.parse(binary)).toThrow(SchemaError);
  });

  test("should handle default values", () => {
    const defaultBinary = new Binary(Buffer.from("default"));
    const schema = M.binary().default(defaultBinary);
    expect(schema.parse(undefined)).toBe(defaultBinary);
  });

  test("should handle defaultFn values", () => {
    const mk = () => new Binary(Buffer.from("gen"));
    const schema = M.binary().defaultFn(mk);
    const result = schema.parse(undefined);
    expect(result).toBeInstanceOf(Binary);
    expect(result.buffer.toString()).toBe("gen");
  });
});
