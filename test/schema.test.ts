import { describe, expect, expectTypeOf, test } from "bun:test";
import { Binary, Decimal128, ObjectId } from "bson";
import { MError } from "../src/error";
import { MongsterSchemaBuilder } from "../src/schema";
import type { InferSchemaInputType, InferSchemaType } from "../src/types/types.schema";

const M = new MongsterSchemaBuilder();

describe("Primitive Schemas", () => {
  describe("NumberSchema", () => {
    test("should parse valid numbers", () => {
      const schema = M.number();
      expect(schema.parse(42)).toBe(42);
      expect(schema.parse(0)).toBe(0);
      expect(schema.parse(-10)).toBe(-10);
      expect(schema.parse(3.14)).toBe(3.14);
    });

    test("should reject invalid types", () => {
      const schema = M.number();
      expect(() => schema.parse("42")).toThrow("Expected a number");
      expect(() => schema.parse(true)).toThrow("Expected a number");
      expect(() => schema.parse(null)).toThrow("Expected a number");
      expect(() => schema.parse({})).toThrow("Expected a number");
    });

    test("should validate min constraint", () => {
      const schema = M.number().min(10);
      expect(schema.parse(15)).toBe(15);
      expect(schema.parse(10)).toBe(10);
      expect(() => schema.parse(5)).toThrow("Value must be greater than or equal to 10");
    });

    test("should validate max constraint", () => {
      const schema = M.number().max(100);
      expect(schema.parse(50)).toBe(50);
      expect(schema.parse(100)).toBe(100);
      expect(() => schema.parse(150)).toThrow("Value must be less than or equal to 100");
    });

    test("should validate enum constraint", () => {
      const schema = M.number().enum([1, 2, 3]);
      expect(schema.parse(1)).toBe(1);
      expect(schema.parse(2)).toBe(2);
      expect(schema.parse(3)).toBe(3);
      expect(() => schema.parse(4)).toThrow("Value must be one of [1, 2, 3]");
    });

    test("should handle default values", () => {
      const schema = M.number().default(42);
      expect(schema.parse(undefined)).toBe(42);
      expect(schema.parse(10)).toBe(10);
    });

    test("should handle defaultFn values", () => {
      const schema = M.number().defaultFn(() => 7);
      expect(schema.parse(undefined)).toBe(7);
      expect(schema.parse(9)).toBe(9);
    });

    test("should handle defaultFn values", () => {
      const schema = M.tuple([M.string(), M.number()]).defaultFn(() => ["x", 1]);
      expect(schema.parse(undefined)).toEqual(["x", 1]);
    });
    test("should chain validation methods", () => {
      const schema = M.number().min(0).max(100).default(50);
      expect(schema.parse(undefined)).toBe(50);
      expect(schema.parse(25)).toBe(25);
      expect(() => schema.parse(-1)).toThrow("Value must be greater than or equal to 0");
      expect(() => schema.parse(101)).toThrow("Value must be less than or equal to 100");
    });
  });

  describe("StringSchema", () => {
    test("should parse valid strings", () => {
      const schema = M.string();
      expect(schema.parse("hello")).toBe("hello");
      expect(schema.parse("")).toBe("");
      expect(schema.parse("world")).toBe("world");
    });

    test("should reject invalid types", () => {
      const schema = M.string();
      expect(() => schema.parse(42)).toThrow("Expected a string");
      expect(() => schema.parse(true)).toThrow("Expected a string");
      expect(() => schema.parse(null)).toThrow("Expected a string");
      expect(() => schema.parse({})).toThrow("Expected a string");
    });

    test("should validate min length", () => {
      const schema = M.string().min(3);
      expect(schema.parse("hello")).toBe("hello");
      expect(schema.parse("abc")).toBe("abc");
      expect(() => schema.parse("ab")).toThrow(
        "Value must be longer than or equal to 3 characters",
      );
    });

    test("should validate max length", () => {
      const schema = M.string().max(5);
      expect(schema.parse("hello")).toBe("hello");
      expect(schema.parse("hi")).toBe("hi");
      expect(() => schema.parse("toolong")).toThrow(
        "Value must be shorter than or equal to 5 characters",
      );
    });

    test("should validate enum constraint", () => {
      const schema = M.string().enum(["red", "green", "blue"]);
      expect(schema.parse("red")).toBe("red");
      expect(schema.parse("green")).toBe("green");
      expect(() => schema.parse("yellow")).toThrow("Value must be one of [red, green, blue]");
    });

    test("should validate regex pattern", () => {
      const schema = M.string().match(/^[a-z]+$/);
      expect(schema.parse("hello")).toBe("hello");
      expect(() => schema.parse("Hello")).toThrow("Value does not follow pattern /^[a-z]+$/");
      expect(() => schema.parse("hello123")).toThrow("Value does not follow pattern /^[a-z]+$/");
    });

    test("should handle default values", () => {
      const schema = M.string().default("default");
      expect(schema.parse(undefined)).toBe("default");
      expect(schema.parse("custom")).toBe("custom");
    });

    test("should handle defaultFn values", () => {
      const schema = M.string().defaultFn(() => "gen");
      expect(schema.parse(undefined)).toBe("gen");
      expect(schema.parse("given")).toBe("given");
    });
  });

  describe("BooleanSchema", () => {
    test("should parse valid booleans", () => {
      const schema = M.boolean();
      expect(schema.parse(true)).toBe(true);
      expect(schema.parse(false)).toBe(false);
    });

    test("should reject invalid types", () => {
      const schema = M.boolean();
      expect(() => schema.parse("true")).toThrow("Expected a boolean");
      expect(() => schema.parse(1)).toThrow("Expected a boolean");
      expect(() => schema.parse(0)).toThrow("Expected a boolean");
      expect(() => schema.parse(null)).toThrow("Expected a boolean");
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

  describe("DateSchema", () => {
    test("should parse valid dates", () => {
      const schema = M.date();
      const date = new Date("2025-01-01");
      expect(schema.parse(date)).toEqual(date);
      expect(schema.parse("2025-01-01")).toEqual(new Date("2025-01-01"));
      expect(schema.parse(1672531200000)).toEqual(new Date(1672531200000));
    });

    test("should reject invalid dates", () => {
      const schema = M.date();
      expect(() => schema.parse("invalid")).toThrow("Invalid date");
      expect(() => schema.parse({})).toThrow("Expected a valid (date | date string | number)");
      expect(() => schema.parse(true)).toThrow("Expected a valid (date | date string | number)");
    });

    test("should validate min date", () => {
      const minDate = new Date("2025-01-01");
      const schema = M.date().min(minDate);

      expect(schema.parse(new Date("2025-06-01"))).toEqual(new Date("2025-06-01"));
      expect(schema.parse(minDate)).toEqual(minDate);
      expect(() => schema.parse(new Date("2022-12-31"))).toThrow(
        "Value must be after or equal to 2025-01-01T00:00:00.000Z",
      );
    });

    test("should validate max date", () => {
      const maxDate = new Date("2025-12-31");
      const schema = M.date().max(maxDate);

      expect(schema.parse(new Date("2025-06-01"))).toEqual(new Date("2025-06-01"));
      expect(schema.parse(maxDate)).toEqual(maxDate);
      expect(() => schema.parse(new Date("2026-01-01"))).toThrow(
        "Value must be before or equal to 2025-12-31T00:00:00.000Z",
      );
    });

    test("should handle default values", () => {
      const defaultDate = new Date("2025-01-01");
      const schema = M.date().default(defaultDate);
      expect(schema.parse(undefined)).toEqual(defaultDate);
    });

    test("should handle defaultFn values", () => {
      const d = new Date("2026-02-02");
      const schema = M.date().defaultFn(() => d);
      expect(schema.parse(undefined)).toEqual(d);
    });
  });
});

describe("BSON Schemas", () => {
  describe("ObjectIdSchema", () => {
    test("should parse valid ObjectIds", () => {
      const schema = M.objectId();
      const objectId = new ObjectId();
      expect(schema.parse(objectId)).toBe(objectId);
    });

    test("should reject invalid types", () => {
      const schema = M.objectId();
      expect(() => schema.parse("507f1f77bcf86cd799439011")).toThrow("Expected an ObjectId");
      expect(() => schema.parse({})).toThrow("Expected an ObjectId");
      expect(() => schema.parse(null)).toThrow("Expected an ObjectId");
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

  describe("Decimal128Schema", () => {
    test("should parse valid Decimal128", () => {
      const schema = M.decimal();
      const decimal = Decimal128.fromString("123.456");
      expect(schema.parse(decimal)).toBe(decimal);
    });

    test("should reject invalid types", () => {
      const schema = M.decimal();
      expect(() => schema.parse(123.456)).toThrow("Expected a Decimal128");
      expect(() => schema.parse("123.456")).toThrow("Expected a Decimal128");
      expect(() => schema.parse({})).toThrow("Expected a Decimal128");
    });

    test("should handle default values", () => {
      const defaultDecimal = Decimal128.fromString("100.00");
      const schema = M.decimal().default(defaultDecimal);
      expect(schema.parse(undefined)).toBe(defaultDecimal);
    });

    test("should handle defaultFn values", () => {
      const d = Decimal128.fromString("200.50");
      const schema = M.decimal().defaultFn(() => d);
      expect(schema.parse(undefined)).toBe(d);
    });
  });

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
      expect(() => schema.parse("hello")).toThrow("Expected a (Binary | Buffer)");
      expect(() => schema.parse(123)).toThrow("Expected a (Binary | Buffer)");
      expect(() => schema.parse([256])).toThrow("Expected a (Binary | Buffer)");
    });

    test("should validate min length", () => {
      const schema = M.binary().min(5);
      expect(() => schema.parse(Buffer.from("hi"))).toThrow("Buffer is too short (min 5)");
      expect(schema.parse(Buffer.from("hello"))).toBeInstanceOf(Binary);
    });

    test("should validate max length", () => {
      const schema = M.binary().max(3);
      expect(() => schema.parse(Buffer.from("hello"))).toThrow("Buffer is too long (max 3)");
      expect(schema.parse(Buffer.from("hi"))).toBeInstanceOf(Binary);
    });

    test("should handle BSON subtypes", () => {
      const schema = M.binary().bsonSubType(Binary.SUBTYPE_UUID);
      const result = schema.parse(Buffer.from("test"));
      expect((result as Binary).sub_type).toBe(Binary.SUBTYPE_UUID);
    });

    test("should validate Binary subtype", () => {
      const schema = M.binary().bsonSubType(Binary.SUBTYPE_UUID);
      const binary = new Binary(Buffer.from("test"), Binary.SUBTYPE_MD5);
      expect(() => schema.parse(binary)).toThrow("Invalid Binary subtype");
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
});

describe("Optional and Nullable Wrappers", () => {
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
      expect(() => schema.parse(5)).toThrow("Value must be greater than or equal to 10");
    });

    test("should work with complex schemas", () => {
      const schema = M.object({
        name: M.string(),
        age: M.number(),
      }).optional();

      expect(schema.parse(undefined)).toBeUndefined();
      expect(schema.parse({ name: "John", age: 30 })).toEqual({ name: "John", age: 30 });
      expect(() => schema.parse({ name: "John" })).toThrow(
        "age: Expected a number, received undefined",
      );
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
      expect(() => schema.parse(150)).toThrow("Value must be less than or equal to 100");
    });

    test("should work with complex schemas", () => {
      const schema = M.array(M.string()).nullable();
      expect(schema.parse(null)).toBeNull();
      expect(schema.parse(["a", "b"])).toEqual(["a", "b"]);
      expect(() => schema.parse([1, 2])).toThrow();
    });
  });

  describe("Chaining Optional and Nullable", () => {
    test("should allow both null and undefined", () => {
      const schema = M.string().nullable().optional();
      expect(schema.parse(undefined)).toBeUndefined();
      expect(schema.parse(null)).toBeNull();
      expect(schema.parse("hello")).toBe("hello");
    });

    test("should work in reverse order", () => {
      const schema = M.string().optional().nullable();
      expect(schema.parse(undefined)).toBeUndefined();
      expect(schema.parse(null)).toBeNull();
      expect(schema.parse("hello")).toBe("hello");
    });
  });
});

describe("Array Schemas", () => {
  describe("ArraySchema", () => {
    test("should parse valid arrays", () => {
      const schema = M.array(M.string());
      expect(schema.parse(["hello", "world"])).toEqual(["hello", "world"]);
      expect(schema.parse([])).toEqual([]);
    });

    test("should reject non-arrays", () => {
      const schema = M.array(M.string());
      expect(() => schema.parse("not an array")).toThrow("Expected an array");
      expect(() => schema.parse({})).toThrow("Expected an array");
      expect(() => schema.parse(null)).toThrow("Expected an array");
    });

    test("should validate item types", () => {
      const schema = M.array(M.number());
      expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3]);
      expect(() => schema.parse([1, "2", 3])).toThrow("[1] Expected a number");
      expect(() => schema.parse([1, 2, "three"])).toThrow("[2] Expected a number");
    });

    test("should validate min length", () => {
      const schema = M.array(M.string()).min(2);
      expect(schema.parse(["a", "b"])).toEqual(["a", "b"]);
      expect(schema.parse(["a", "b", "c"])).toEqual(["a", "b", "c"]);
      expect(() => schema.parse([])).toThrow("Array length must be greater than or equal to 2");
      expect(() => schema.parse(["a"])).toThrow("Array length must be greater than or equal to 2");
    });

    test("should validate max length", () => {
      const schema = M.array(M.string()).max(2);
      expect(schema.parse([])).toEqual([]);
      expect(schema.parse(["a"])).toEqual(["a"]);
      expect(schema.parse(["a", "b"])).toEqual(["a", "b"]);
      expect(() => schema.parse(["a", "b", "c"])).toThrow(
        "Array length must be less than or equal to 2",
      );
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
      ];
      expect(schema.parse(validData)).toEqual(validData);

      expect(() => schema.parse([{ id: 1 }])).toThrow();
      expect(() => schema.parse([{ name: "Alice" }])).toThrow();
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
      ).toThrow();
    });

    test("should chain validations", () => {
      const schema = M.array(M.number().min(0)).min(1).max(5).default([1, 2, 3]);
      expect(schema.parse(undefined)).toEqual([1, 2, 3]);
      expect(schema.parse([1, 2])).toEqual([1, 2]);
      expect(() => schema.parse([])).toThrow("Array length must be greater than or equal to 1");
      expect(() => schema.parse([1, 2, 3, 4, 5, 6])).toThrow(
        "Array length must be less than or equal to 5",
      );
      expect(() => schema.parse([1, -1, 3])).toThrow(
        "[1] Value must be greater than or equal to 0",
      );
    });
  });

  describe("Array method on other schemas", () => {
    test("should create array from primitive schema", () => {
      const schema = M.string().array();
      expect(schema.parse(["hello", "world"])).toEqual(["hello", "world"]);
      expect(() => schema.parse([1, 2])).toThrow();
    });

    test("should create array from complex schema", () => {
      const schema = M.object({ name: M.string() }).array();
      expect(schema.parse([{ name: "Alice" }, { name: "Bob" }])).toEqual([
        { name: "Alice" },
        { name: "Bob" },
      ]);
    });
  });
});

describe("Tuple Schemas", () => {
  describe("TupleSchema", () => {
    test("should parse valid tuples", () => {
      const schema = M.tuple([M.string(), M.number(), M.boolean()]);
      expect(schema.parse(["hello", 42, true])).toEqual(["hello", 42, true]);
    });

    test("should reject non-arrays", () => {
      const schema = M.tuple([M.string(), M.number()]);
      expect(() => schema.parse("not a tuple")).toThrow("Expected a tuple (must be an array)");
      expect(() => schema.parse({})).toThrow("Expected a tuple (must be an array)");
      expect(() => schema.parse(null)).toThrow("Expected a tuple (must be an array)");
    });

    test("should validate exact length", () => {
      const schema = M.tuple([M.string(), M.number()]);
      expect(() => schema.parse(["hello"])).toThrow(
        "Expected tuple of length 2, received of length 1",
      );
      expect(() => schema.parse(["hello", 42, true])).toThrow(
        "Expected tuple of length 2, received of length 3",
      );
      expect(schema.parse(["hello", 42])).toEqual(["hello", 42]);
    });

    test("should validate item types at correct positions", () => {
      const schema = M.tuple([M.string(), M.number(), M.boolean()]);
      expect(() => schema.parse([42, "hello", true])).toThrow("[0] Expected a string");
      expect(() => schema.parse(["hello", "world", true])).toThrow("[1] Expected a number");
      expect(() => schema.parse(["hello", 42, "not boolean"])).toThrow("[2] Expected a boolean");
    });

    test("should work with complex schemas", () => {
      const schema = M.tuple([
        M.object({ name: M.string() }),
        M.array(M.number()),
        M.string().optional(),
      ]);

      expect(schema.parse([{ name: "Alice" }, [1, 2, 3], undefined])).toEqual([
        { name: "Alice" },
        [1, 2, 3],
        undefined,
      ]);

      expect(() => schema.parse([{ name: "Alice" }, ["not", "numbers"], undefined])).toThrow();
    });

    test("should handle default values", () => {
      const defaultTuple: [string, number] = ["default", 0];
      const schema = M.tuple([M.string(), M.number()]).default(defaultTuple);
      expect(schema.parse(undefined)).toEqual(defaultTuple);
      expect(schema.parse(["custom", 42])).toEqual(["custom", 42]);
    });

    test("should work with nested tuples", () => {
      const schema = M.tuple([M.string(), M.tuple([M.number(), M.boolean()])]);

      expect(schema.parse(["hello", [42, true]])).toEqual(["hello", [42, true]]);
      expect(() => schema.parse(["hello", [42, "not boolean"]])).toThrow();
    });
  });

  describe("fixedArrayOf method", () => {
    test("should work same as tuple", () => {
      const schema = M.fixedArrayOf(M.string(), M.number(), M.boolean());
      expect(schema.parse(["hello", 42, true])).toEqual(["hello", 42, true]);
      expect(() => schema.parse(["hello", 42])).toThrow(
        "Expected tuple of length 3, received of length 2",
      );
    });
  });
});

describe("Union Schemas", () => {
  describe("UnionSchema", () => {
    test("should parse values matching any schema", () => {
      const schema = M.union(M.string(), M.number());
      expect(schema.parse("hello")).toBe("hello");
      expect(schema.parse(42)).toBe(42);
    });

    test("should reject values not matching any schema", () => {
      const schema = M.union(M.string(), M.number());
      expect(() => schema.parse(true)).toThrow("Expected one of: StringSchema | NumberSchema");
      expect(() => schema.parse({})).toThrow("Expected one of: StringSchema | NumberSchema");
      expect(() => schema.parse(null)).toThrow("Expected one of: StringSchema | NumberSchema");
    });

    test("should work with complex schemas", () => {
      const schema = M.union(
        M.object({ type: M.string().enum(["user"]), name: M.string() }),
        M.object({ type: M.string().enum(["admin"]), permissions: M.array(M.string()) }),
      );

      expect(schema.parse({ type: "user", name: "Alice" })).toEqual({
        type: "user",
        name: "Alice",
      });
      expect(schema.parse({ type: "admin", permissions: ["read", "write"] })).toEqual({
        type: "admin",
        permissions: ["read", "write"],
      });

      expect(() => schema.parse({ type: "user", permissions: [] })).toThrow();
      expect(() => schema.parse({ type: "guest", name: "Bob" })).toThrow();
    });

    test("should handle multiple primitive types", () => {
      const schema = M.union(M.string(), M.number(), M.boolean(), M.date());
      const date = new Date();

      expect(schema.parse("hello")).toBe("hello");
      expect(schema.parse(42)).toBe(42);
      expect(schema.parse(true)).toBe(true);
      expect(schema.parse(date)).toBe(date);
    });

    test("should work with nullable and optional", () => {
      const schema = M.union(M.string(), M.number()).nullable();
      expect(schema.parse(null)).toBeNull();
      expect(schema.parse("hello")).toBe("hello");
      expect(schema.parse(42)).toBe(42);

      const optionalSchema = M.union(M.string(), M.number()).optional();
      expect(optionalSchema.parse(undefined)).toBeUndefined();
      expect(optionalSchema.parse("hello")).toBe("hello");
    });

    test("should handle default values", () => {
      const schema = M.union(M.string(), M.number()).default("default");
      expect(schema.parse(undefined)).toBe("default");
      expect(schema.parse(42)).toBe(42);
    });

    test("should handle defaultFn values", () => {
      const schema = M.union(M.string(), M.number()).defaultFn(() => 123);
      expect(schema.parse(undefined)).toBe(123);
    });

    test("should work with arrays and objects", () => {
      const schema = M.union(M.array(M.string()), M.object({ count: M.number() }));

      expect(schema.parse(["a", "b", "c"])).toEqual(["a", "b", "c"]);
      expect(schema.parse({ count: 5 })).toEqual({ count: 5 });
      expect(() => schema.parse([1, 2, 3])).toThrow();
      expect(() => schema.parse({ count: "not a number" })).toThrow();
    });

    test("should validate constraints on matching schema", () => {
      const schema = M.union(M.string().min(5), M.number().max(100));

      expect(schema.parse("hello")).toBe("hello");
      expect(schema.parse(50)).toBe(50);
      expect(() => schema.parse("hi")).toThrow();
      expect(() => schema.parse(150)).toThrow();
    });
  });

  describe("oneOf method", () => {
    test("should work same as union", () => {
      const schema = M.oneOf([M.string(), M.number(), M.boolean()]);
      expect(schema.parse("hello")).toBe("hello");
      expect(schema.parse(42)).toBe(42);
      expect(schema.parse(true)).toBe(true);
      expect(() => schema.parse({})).toThrow();
    });
  });
});

describe("Object Schemas", () => {
  describe("ObjectSchema", () => {
    test("should parse valid objects", () => {
      const schema = M.object({
        name: M.string(),
        age: M.number(),
        active: M.boolean(),
      });

      const data = { name: "Alice", age: 30, active: true };
      expect(schema.parse(data)).toEqual(data);
    });

    test("should reject non-objects", () => {
      const schema = M.object({ name: M.string() });
      expect(() => schema.parse("not an object")).toThrow("Expected an object");
      expect(() => schema.parse(42)).toThrow("Expected an object");
      expect(() => schema.parse(null)).toThrow();
      expect(() => schema.parse([])).toThrow("Expected an object, but received an array");
    });

    test("should validate all properties", () => {
      const schema = M.object({
        name: M.string(),
        age: M.number().min(0),
      });

      expect(() => schema.parse({ name: "Alice" })).toThrow(
        "age: Expected a number, received undefined",
      );
      expect(() => schema.parse({ age: 30 })).toThrow(
        "name: Expected a string, but received undefined. Field is required.",
      );
      expect(() => schema.parse({ name: 123, age: 30 })).toThrow("name: Expected a string");
      expect(() => schema.parse({ name: "Alice", age: -5 })).toThrow(
        "age: Value must be greater than or equal to 0",
      );
    });

    test("should work with nested objects", () => {
      const schema = M.object({
        user: M.object({
          name: M.string(),
          contact: M.object({
            email: M.string(),
            phone: M.string().optional(),
          }),
        }),
        metadata: M.object({
          created: M.date().default(new Date()),
          tags: M.array(M.string()),
        }),
      });

      type TInput = InferSchemaInputType<typeof schema>;
      expectTypeOf<TInput>().toEqualTypeOf<{
        user: { name: string; contact: { email: string; phone?: string | undefined } };
        metadata: { created?: Date | undefined; tags: string[] };
      }>();

      const inputData = {
        user: {
          name: "Alice",
          contact: {
            email: "alice@example.com",
            phone: undefined,
          },
        },
        metadata: {
          created: new Date(),
          tags: ["user", "active"],
        },
      };

      expect(schema.parse(inputData)).toEqual(inputData);

      expect(() =>
        schema.parse({
          user: {
            name: "Alice",
            contact: { email: "alice@example.com" },
          },
          metadata: {
            created: "invalid date",
            tags: ["user"],
          },
        }),
      ).toThrow();
    });

    test("should handle default values", () => {
      const defaultObj = { name: "Default", count: 0 };
      const schema = M.object({
        name: M.string(),
        count: M.number(),
      }).default(defaultObj);

      expect(schema.parse(undefined)).toEqual(defaultObj);
      expect(schema.parse({ name: "Custom", count: 5 })).toEqual({ name: "Custom", count: 5 });
    });

    test("should handle defaultFn values", () => {
      const schema = M.object({ name: M.string(), count: M.number() }).defaultFn(() => ({
        name: "Gen",
        count: 1,
      }));
      expect(schema.parse(undefined)).toEqual({ name: "Gen", count: 1 });
    });

    test("should work with optional properties", () => {
      const schema = M.object({
        name: M.string(),
        age: M.number().optional(),
        email: M.string().nullable(),
        active: M.boolean().default(true),
      });

      type TSchemaType = InferSchemaType<typeof schema>;
      expectTypeOf<TSchemaType>().toEqualTypeOf<{
        _id: ObjectId;
        name: string;
        age?: number | undefined;
        email: string | null;
        active: boolean;
      }>();

      type TInputType = InferSchemaInputType<typeof schema>;
      expectTypeOf<TInputType>().toEqualTypeOf<{
        name: string;
        age?: number | undefined;
        email: string | null;
        active?: boolean | undefined;
      }>();

      expect(
        schema.parse({
          name: "Alice",
          age: undefined,
          email: null,
          active: undefined,
        }),
      ).toEqual({
        name: "Alice",
        age: undefined,
        email: null,
        active: true,
      });
    });

    test("should work with arrays of objects", () => {
      const schema = M.object({
        users: M.array(
          M.object({
            id: M.number(),
            name: M.string(),
          }),
        ),
      });

      const data = {
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
      };

      expect(schema.parse(data)).toEqual(data);
      expect(() =>
        schema.parse({
          users: [
            { id: 1, name: "Alice" },
            { id: "invalid", name: "Bob" },
          ],
        }),
      ).toThrow();
    });
  });
});

describe("Deeply Nested Structures", () => {
  test("should handle complex nested array of objects with unions", () => {
    const schema = M.array(
      M.object({
        id: M.string(),
        data: M.union(
          M.object({
            type: M.string().enum(["text"] as const),
            content: M.string(),
            metadata: M.object({
              length: M.number(),
              words: M.array(M.string()),
            }).optional(),
          }),
          M.object({
            type: M.string().enum(["image"] as const),
            url: M.string(),
            dimensions: M.tuple([M.number(), M.string()]),
          }),
        ),
        tags: M.array(M.string()).optional(),
        active: M.boolean().default(true),
      }),
    );

    type TInput = InferSchemaInputType<typeof schema>;
    expectTypeOf<TInput>().toEqualTypeOf<
      {
        id: string;
        data:
          | {
              type: "text";
              content: string;
              metadata?: { length: number; words: string[] } | undefined;
            }
          | { type: "image"; url: string; dimensions: readonly [number, string] };
        tags?: string[] | undefined;
        active?: boolean | undefined;
      }[]
    >();

    const validData: TInput = [
      {
        id: "1",
        data: {
          type: "text",
          content: "Hello world",
          metadata: {
            length: 11,
            words: ["Hello", "world"],
          },
        },
        tags: ["article", "public"],
        active: undefined,
      },
      {
        id: "2",
        data: {
          type: "image",
          url: "https://example.com/image.jpg",
          dimensions: [800, "600"],
        },
        tags: undefined,
        active: false,
      },
    ];

    const result = schema.parse(validData);
    expect(result[0]!.active).toBe(true);
    expect(result[1]!.active).toBe(false);
    expect(result[0]!.data.type).toBe("text");
    expect(result[1]!.data.type).toBe("image");
  });

  test("should handle nested tuples with complex schemas", () => {
    const schema = M.tuple([
      M.string(),
      M.array(
        M.tuple([
          M.number(),
          M.object({
            nested: M.union(M.array(M.string()), M.object({ count: M.number() })),
          }),
        ]),
      ),
      M.object({
        complex: M.array(M.union(M.string(), M.tuple([M.number(), M.boolean()]))).optional(),
      }),
    ]);

    const validData: InferSchemaInputType<typeof schema> = [
      "header",
      [
        [1, { nested: ["a", "b", "c"] }],
        [2, { nested: { count: 42 } }],
      ],
      {
        complex: ["text", [123, true], "more text", [456, false]],
      },
    ];

    expect(schema.parse(validData)).toEqual(validData);
  });

  test("should handle deeply nested object hierarchy", () => {
    const schema = M.object({
      level1: M.object({
        level2: M.object({
          level3: M.object({
            level4: M.object({
              level5: M.array(
                M.object({
                  data: M.union(
                    M.string(),
                    M.array(M.number()),
                    M.object({
                      nested: M.tuple([M.boolean(), M.string().optional()]),
                    }),
                  ),
                }),
              ),
            }),
          }),
        }),
      }),
    });

    const validData: InferSchemaInputType<typeof schema> = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: [
                { data: "simple string" },
                { data: [1, 2, 3, 4, 5] },
                { data: { nested: [true, "optional"] } },
                { data: { nested: [false, undefined] } },
              ],
            },
          },
        },
      },
    };

    expect(schema.parse(validData)).toEqual(validData);
  });

  test("should handle mixed arrays and objects with all schema types", () => {
    const schema = M.array(
      M.union(
        M.object({
          type: M.string().enum(["user"]),
          profile: M.object({
            name: M.string(),
            age: M.number().optional(),
            preferences: M.object({
              theme: M.string().enum(["light", "dark"]).default("light"),
              notifications: M.boolean().default(true),
              languages: M.array(M.string()).min(1),
            }),
          }),
          metadata: M.tuple([M.date(), M.objectId(), M.array(M.string()).optional()]),
        }),
        M.object({
          type: M.string().enum(["system"]),
          config: M.object({
            version: M.string(),
            features: M.array(
              M.object({
                name: M.string(),
                enabled: M.boolean(),
                settings: M.union(
                  M.object({ mode: M.string() }),
                  M.array(M.number()),
                  M.string(),
                ).nullable(),
              }),
            ),
          }),
        }),
      ),
    );

    const validData = [
      {
        type: "user",
        profile: {
          name: "Alice",
          age: 30,
          preferences: {
            theme: undefined,
            notifications: false,
            languages: ["en", "es"],
          },
        },
        metadata: [new Date(), new ObjectId(), ["tag1", "tag2"]],
      },
      {
        type: "system",
        config: {
          version: "1.0.0",
          features: [
            {
              name: "feature1",
              enabled: true,
              settings: { mode: "auto" },
            },
            {
              name: "feature2",
              enabled: false,
              settings: [1, 2, 3],
            },
            {
              name: "feature3",
              enabled: true,
              settings: null,
            },
          ],
        },
      },
    ];

    const result = schema.parse(validData);
    expect(result[0]!.type).toBe("user");
    expect((result[0] as any).profile.preferences.theme).toBe("light");
    expect(result[1]!.type).toBe("system");
  });

  test("should provide meaningful error messages for nested failures", () => {
    const schema = M.object({
      users: M.array(
        M.object({
          profile: M.object({
            contact: M.object({
              email: M.string(),
              phone: M.string().optional(),
            }),
          }),
        }),
      ),
    });

    expect(() =>
      schema.parse({
        users: [
          {
            profile: {
              contact: {
                email: "valid@example.com",
              },
            },
          },
          {
            profile: {
              contact: {
                email: 123,
              },
            },
          },
        ],
      }),
    ).toThrow("users: [1] profile: contact: email: Expected a string");
  });
});

describe("MongsterSchema Root Schema", () => {
  describe("MongsterSchema", () => {
    test("should parse valid root documents", () => {
      const schema = M.schema({
        _id: M.objectId(),
        name: M.string(),
        email: M.string(),
        age: M.number().min(0),
        active: M.boolean().default(true),
      });

      const data = {
        _id: new ObjectId(),
        name: "Alice",
        email: "alice@example.com",
        age: 30,
        active: undefined,
      };

      const result = schema.parse(data);
      expect(result.active).toBe(true);
      expect(result.name).toBe("Alice");
    });

    test("should work with timestamps", () => {
      const schema = M.schema({
        name: M.string(),
        description: M.string().optional(),
      }).withTimestamps();

      const data = {
        name: "Test Document",
        description: undefined,
      };

      expect(() => schema.parse(data)).not.toThrow();
    });

    test("should handle complex nested schemas", () => {
      const schema = M.schema({
        _id: M.objectId().default("generate"),
        user: M.object({
          profile: M.object({
            name: M.string(),
            avatar: M.string().optional(),
          }),
          settings: M.object({
            theme: M.string().enum(["light", "dark"]).default("light"),
            notifications: M.boolean().default(true),
          }),
        }),
        posts: M.array(
          M.object({
            id: M.string(),
            title: M.string(),
            content: M.string(),
            tags: M.array(M.string()).default([]),
            metadata: M.object({
              views: M.number().default(0),
              likes: M.number().default(0),
              created: M.date(),
            }),
          }),
        ),
        status: M.union(
          M.string().enum(["active", "inactive", "suspended"]),
          M.object({
            type: M.string().enum(["custom"]),
            reason: M.string(),
          }),
        ),
      });

      const data = {
        _id: undefined,
        user: {
          profile: {
            name: "John Doe",
            avatar: undefined,
          },
          settings: {
            theme: undefined,
            notifications: false,
          },
        },
        posts: [
          {
            id: "post1",
            title: "My First Post",
            content: "Hello world!",
            tags: undefined,
            metadata: {
              views: undefined,
              likes: undefined,
              created: new Date("2025-01-01"),
            },
          },
        ],
        status: "active",
      };

      const result = schema.parse(data);
      expect(result._id).toBeInstanceOf(ObjectId);
      expect(result.user.settings.theme).toBe("light");
      expect(result.posts[0]!.tags).toEqual([]);
      expect(result.posts[0]!.metadata.views).toBe(0);
    });

    test("should validate all required fields", () => {
      const schema = M.schema({
        name: M.string(),
        email: M.string(),
        age: M.number(),
      });

      expect(() =>
        schema.parse({
          name: "Alice",
          email: "alice@example.com",
        }),
      ).toThrow("age: Expected a number, received undefined");

      expect(() =>
        schema.parse({
          name: "Alice",
          age: 30,
        }),
      ).toThrow("email: Expected a string, but received undefined. Field is required.");
    });

    test("should reject non-objects", () => {
      const schema = M.schema({
        name: M.string(),
      });

      expect(() => schema.parse("not an object")).toThrow("Expected an object");
      expect(() => schema.parse([])).toThrow("Expected an object, but received an array");
      expect(() => schema.parse(null)).toThrow("Expected an object");
    });

    test("should work with all schema types", () => {
      const schema = M.schema({
        _id: M.objectId(),
        string_field: M.string(),
        number_field: M.number(),
        boolean_field: M.boolean(),
        date_field: M.date(),
        decimal_field: M.decimal(),
        binary_field: M.binary(),
        array_field: M.array(M.string()),
        tuple_field: M.tuple([M.string(), M.number()]),
        union_field: M.union(M.string(), M.number()),
        object_field: M.object({
          nested: M.string(),
        }),
        optional_field: M.string().optional(),
        nullable_field: M.string().nullable(),
      });

      const data = {
        _id: new ObjectId(),
        string_field: "test",
        number_field: 42,
        boolean_field: true,
        date_field: new Date(),
        decimal_field: Decimal128.fromString("123.45"),
        binary_field: Buffer.from("test"),
        array_field: ["a", "b", "c"],
        tuple_field: ["hello", 123] as [string, number],
        union_field: "string value",
        object_field: {
          nested: "nested value",
        },
        optional_field: undefined,
        nullable_field: null,
      };

      expect(() => schema.parse(data)).not.toThrow();
    });
  });
});

describe("Custom Validation and Error Handling", () => {
  describe("Custom validation", () => {
    test("should apply custom validation", () => {
      const schema = M.string().validate((value) => value.includes("@"));

      expect(schema.parse("test@example.com")).toBe("test@example.com");
      expect(() => schema.parse("invalid")).toThrow("Custom validation failed");
    });

    test("should work with custom error messages", () => {
      const schema = M.number().validate((value) => value % 2 === 0, "Number must be even");

      expect(schema.parse(4)).toBe(4);
      expect(() => schema.parse(3)).toThrow("Number must be even");
    });

    test("should validate after inner schema validation", () => {
      const schema = M.string()
        .min(5)
        .validate((value) => value.startsWith("test"));

      expect(() => schema.parse("hi")).toThrow(
        "Value must be longer than or equal to 5 characters",
      );
      expect(() => schema.parse("hello")).toThrow("Custom validation failed");
      expect(schema.parse("test123")).toBe("test123");
    });

    test("should work with complex schemas", () => {
      const schema = M.object({
        username: M.string().validate((value) => /^[a-zA-Z0-9_]+$/.test(value)),
        email: M.string().validate((value) => value.includes("@") && value.includes(".")),
        age: M.number().validate((value) => value >= 13),
      });

      expect(
        schema.parse({
          username: "valid_user123",
          email: "user@example.com",
          age: 25,
        }),
      ).toEqual({
        username: "valid_user123",
        email: "user@example.com",
        age: 25,
      });

      expect(() =>
        schema.parse({
          username: "invalid-user!",
          email: "user@example.com",
          age: 25,
        }),
      ).toThrow("username: Custom validation failed");

      expect(() =>
        schema.parse({
          username: "valid_user",
          email: "invalid-email",
          age: 25,
        }),
      ).toThrow("email: Custom validation failed");

      expect(() =>
        schema.parse({
          username: "valid_user",
          email: "user@example.com",
          age: 12,
        }),
      ).toThrow("age: Custom validation failed");
    });

    test("should work with arrays and custom validation", () => {
      const schema = M.array(M.string().validate((value) => value.length > 2)).validate(
        (arr) => arr.length >= 2,
      );

      expect(schema.parse(["abc", "def", "ghi"])).toEqual(["abc", "def", "ghi"]);
      expect(() => schema.parse(["ab", "def"])).toThrow("[0]");
      expect(() => schema.parse(["abc"])).toThrow("Custom validation failed");
    });
  });

  describe("Error handling and messages", () => {
    test("should provide detailed error paths", () => {
      const schema = M.object({
        users: M.array(
          M.object({
            name: M.string(),
            contacts: M.array(
              M.object({
                type: M.string().enum(["email", "phone"]),
                value: M.string(),
              }),
            ),
          }),
        ),
      });

      expect(() =>
        schema.parse({
          users: [
            {
              name: "Alice",
              contacts: [{ type: "email", value: "alice@example.com" }],
            },
            {
              name: "Bob",
              contacts: [{ type: "invalid", value: "bob@example.com" }],
            },
          ],
        }),
      ).toThrow("users: [1] contacts: [0] type: Value must be one of [email, phone]");
    });

    test("should handle MError instances", () => {
      const schema = M.string();

      try {
        schema.parse(123);
      } catch (error) {
        expect(error).toBeInstanceOf(MError);
        expect((error as MError).message).toBe("Expected a string");
      }
    });

    test("should chain error contexts correctly", () => {
      const schema = M.object({
        level1: M.object({
          level2: M.object({
            value: M.string().min(10),
          }),
        }),
      });

      expect(() =>
        schema.parse({
          level1: {
            level2: {
              value: "short",
            },
          },
        }),
      ).toThrow("level1: level2: value: Value must be longer than or equal to 10 characters");
    });

    test("should handle validation errors in unions", () => {
      const schema = M.union(
        M.object({ type: M.string().enum(["A"]), valueA: M.string() }),
        M.object({ type: M.string().enum(["B"]), valueB: M.number() }),
      );

      expect(() =>
        schema.parse({
          type: "C",
          value: "something",
        }),
      ).toThrow("Expected one of: ObjectSchema | ObjectSchema");
    });

    test("should handle mixed validation and parsing errors", () => {
      const schema = M.object({
        requiredString: M.string(),
        optionalNumber: M.number().min(0).optional(),
        validatedEmail: M.string().validate((v) => v.includes("@")),
      });

      expect(() =>
        schema.parse({
          requiredString: 123,
          optionalNumber: -5,
          validatedEmail: "invalid-email",
        }),
      ).toThrow();
    });
  });
});
