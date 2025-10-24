import { describe, expect, test } from "bun:test";
import { MongsterSchemaBuilder } from "../src/schema";

const M = new MongsterSchemaBuilder();

/**
 * Comprehensive test suite for MongsterSchema.getJsonSchema() method
 *
 * Tests cover:
 * - Primitive types (string, number, boolean, date)
 * - Constraints (min/max, minLength/maxLength, pattern, enum)
 * - BSON types (ObjectId, Decimal128, Binary)
 * - Array types (with constraints, nested arrays)
 * - Tuple types (fixed-position arrays)
 * - Object types (nested, deeply nested)
 * - Union types (primitives, objects, BSON types)
 * - Optional fields
 * - Default values
 * - Complex real-world schemas (user, e-commerce)
 * - Edge cases (empty schema, single field, deep nesting)
 * - Special patterns (regex, combined constraints)
 * - MongoDB-specific features (timestamps, additionalProperties)
 *
 * Total: 51 tests
 * Status: All tests currently fail (method returns empty object)
 */

describe("JSON Schema Conversion", () => {
  describe("Primitive Types", () => {
    test("should convert number schema to JSON schema", () => {
      const schema = M.schema({
        age: M.number(),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema).toEqual({
        type: "object",
        properties: {
          age: { type: "number" },
        },
        required: ["age"],
      });
    });

    test("should convert string schema to JSON schema", () => {
      const schema = M.schema({
        name: M.string(),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema).toEqual({
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      });
    });

    test("should convert boolean schema to JSON schema", () => {
      const schema = M.schema({
        isActive: M.boolean(),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema).toEqual({
        type: "object",
        properties: {
          isActive: { type: "boolean" },
        },
        required: ["isActive"],
      });
    });

    test("should convert date schema to JSON schema", () => {
      const schema = M.schema({
        createdAt: M.date(),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema).toEqual({
        type: "object",
        properties: {
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["createdAt"],
      });
    });
  });

  describe("Number Constraints", () => {
    test("should include minimum constraint", () => {
      const schema = M.schema({
        age: M.number().min(18),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.age).toEqual({
        type: "number",
        minimum: 18,
      });
    });

    test("should include maximum constraint", () => {
      const schema = M.schema({
        age: M.number().max(100),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.age).toEqual({
        type: "number",
        maximum: 100,
      });
    });

    test("should include both min and max constraints", () => {
      const schema = M.schema({
        age: M.number().min(18).max(100),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.age).toEqual({
        type: "number",
        minimum: 18,
        maximum: 100,
      });
    });

    test("should include enum constraint for numbers", () => {
      const schema = M.schema({
        rating: M.number().enum([1, 2, 3, 4, 5]),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.rating).toEqual({
        type: "number",
        enum: [1, 2, 3, 4, 5],
      });
    });
  });

  describe("String Constraints", () => {
    test("should include minLength constraint", () => {
      const schema = M.schema({
        username: M.string().min(3),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.username).toEqual({
        type: "string",
        minLength: 3,
      });
    });

    test("should include maxLength constraint", () => {
      const schema = M.schema({
        username: M.string().max(20),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.username).toEqual({
        type: "string",
        maxLength: 20,
      });
    });

    test("should include both minLength and maxLength", () => {
      const schema = M.schema({
        username: M.string().min(3).max(20),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.username).toEqual({
        type: "string",
        minLength: 3,
        maxLength: 20,
      });
    });

    test("should include pattern constraint", () => {
      const schema = M.schema({
        email: M.string().match(/^[a-z0-9@.]+$/),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.email).toEqual({
        type: "string",
        pattern: "^[a-z0-9@.]+$",
      });
    });

    test("should include enum constraint for strings", () => {
      const schema = M.schema({
        status: M.string().enum(["active", "inactive", "pending"]),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.status).toEqual({
        type: "string",
        enum: ["active", "inactive", "pending"],
      });
    });
  });

  describe("BSON Types", () => {
    test("should convert ObjectId schema to JSON schema", () => {
      const schema = M.schema({
        userId: M.objectId(),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.userId).toEqual({
        type: "string",
        pattern: "^[a-f0-9]{24}$",
      });
    });

    test("should convert Decimal128 schema to JSON schema", () => {
      const schema = M.schema({
        price: M.decimal(),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.price).toEqual({
        type: "string",
        pattern: "^[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?$",
      });
    });

    test("should convert Binary schema to JSON schema", () => {
      const schema = M.schema({
        data: M.binary().bsonSubType(5),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.data).toEqual({
        type: "object",
        properties: {
          bytes: {
            type: "string",
            pattern: "^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$",
          },
          subtype: { type: "integer", const: 5 },
        },
        required: ["bytes", "subtype"],
        additionalProperties: false,
      });
    });
  });

  describe("Array Types", () => {
    test("should convert array of numbers to JSON schema", () => {
      const schema = M.schema({
        scores: M.array(M.number()),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.scores).toEqual({
        type: "array",
        items: { type: "number" },
      });
    });

    test("should convert array of strings to JSON schema", () => {
      const schema = M.schema({
        tags: M.array(M.string()),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.tags).toEqual({
        type: "array",
        items: { type: "string" },
      });
    });

    test("should convert array of objects to JSON schema", () => {
      const schema = M.schema({
        items: M.array(
          M.object({
            name: M.string(),
            quantity: M.number(),
          }),
        ),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.items).toEqual({
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
          },
          required: ["name", "quantity"],
        },
      });
    });

    test("should handle array min constraint", () => {
      const schema = M.schema({
        tags: M.array(M.string()).min(1),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.tags).toEqual({
        type: "array",
        items: { type: "string" },
        minItems: 1,
      });
    });

    test("should handle array max constraint", () => {
      const schema = M.schema({
        tags: M.array(M.string()).max(10),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.tags).toEqual({
        type: "array",
        items: { type: "string" },
        maxItems: 10,
      });
    });

    test("should handle nested arrays", () => {
      const schema = M.schema({
        matrix: M.array(M.array(M.number())),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.matrix).toEqual({
        type: "array",
        items: {
          type: "array",
          items: { type: "number" },
        },
      });
    });
  });

  describe("Tuple Types", () => {
    test("should convert tuple to JSON schema with items array", () => {
      const schema = M.schema({
        coordinates: M.tuple([M.number(), M.number()]),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.coordinates).toEqual({
        type: "array",
        items: [{ type: "number" }, { type: "number" }],
        minItems: 2,
        maxItems: 2,
      });
    });

    test("should convert mixed type tuple to JSON schema", () => {
      const schema = M.schema({
        record: M.tuple([M.string(), M.number(), M.boolean()]),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.record).toEqual({
        type: "array",
        items: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
        minItems: 3,
        maxItems: 3,
      });
    });
  });

  describe("Object Types", () => {
    test("should convert nested object to JSON schema", () => {
      const schema = M.schema({
        address: M.object({
          street: M.string(),
          city: M.string(),
          zipCode: M.string(),
        }),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.address).toEqual({
        type: "object",
        properties: {
          street: { type: "string" },
          city: { type: "string" },
          zipCode: { type: "string" },
        },
        required: ["street", "city", "zipCode"],
      });
    });

    test("should handle deeply nested objects", () => {
      const schema = M.schema({
        user: M.object({
          profile: M.object({
            name: M.string(),
            age: M.number(),
          }),
          settings: M.object({
            theme: M.string(),
            notifications: M.boolean(),
          }),
        }),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.user).toEqual({
        type: "object",
        properties: {
          profile: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
            },
            required: ["name", "age"],
          },
          settings: {
            type: "object",
            properties: {
              theme: { type: "string" },
              notifications: { type: "boolean" },
            },
            required: ["theme", "notifications"],
          },
        },
        required: ["profile", "settings"],
      });
    });
  });

  describe("Union Types", () => {
    test("should convert union of primitives to anyOf", () => {
      const schema = M.schema({
        value: M.union(M.string(), M.number()),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.value).toEqual({
        anyOf: [{ type: "string" }, { type: "number" }],
      });
    });

    test("should convert union of objects to anyOf", () => {
      const schema = M.schema({
        data: M.union(
          M.object({ type: M.string().enum(["text"]), content: M.string() }),
          M.object({ type: M.string().enum(["number"]), value: M.number() }),
        ),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.data).toEqual({
        anyOf: [
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["text"] },
              content: { type: "string" },
            },
            required: ["type", "content"],
          },
          {
            type: "object",
            properties: {
              type: { type: "string", enum: ["number"] },
              value: { type: "number" },
            },
            required: ["type", "value"],
          },
        ],
      });
    });

    test("should handle union with BSON types", () => {
      const schema = M.schema({
        id: M.union(M.objectId(), M.string()),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.id).toEqual({
        anyOf: [{ type: "string", pattern: "^[a-f0-9]{24}$" }, { type: "string" }],
      });
    });
  });

  describe("Optional Fields", () => {
    test("should mark optional fields correctly", () => {
      const schema = M.schema({
        name: M.string(),
        nickname: M.string().optional(),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema).toEqual({
        type: "object",
        properties: {
          name: { type: "string" },
          nickname: { type: "string" },
        },
        required: ["name"],
      });
    });

    test("should handle all optional fields", () => {
      const schema = M.schema({
        field1: M.string().optional(),
        field2: M.number().optional(),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.required).toEqual([]);
    });

    test("should handle nested optional objects", () => {
      const schema = M.schema({
        address: M.object({
          street: M.string(),
          apartment: M.string().optional(),
        }),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.address).toEqual({
        type: "object",
        properties: {
          street: { type: "string" },
          apartment: { type: "string" },
        },
        required: ["street"],
      });
    });
  });

  describe("Default Values", () => {
    test("should include default value in JSON schema", () => {
      const schema = M.schema({
        status: M.string().default("active"),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.status).toEqual({
        type: "string",
        default: "active",
      });
    });

    test("should include default for numbers", () => {
      const schema = M.schema({
        count: M.number().default(0),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.count).toEqual({
        type: "number",
        default: 0,
      });
    });

    test("should include default for booleans", () => {
      const schema = M.schema({
        isActive: M.boolean().default(true),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.isActive).toEqual({
        type: "boolean",
        default: true,
      });
    });

    test("should not include defaultFn in JSON schema", () => {
      const schema = M.schema({
        timestamp: M.date().defaultFn(() => new Date()),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.timestamp).toEqual({
        type: "string",
        format: "date-time",
      });
    });
  });

  describe("Complex Schemas", () => {
    test("should convert complex user schema", () => {
      const schema = M.schema({
        _id: M.objectId(),
        username: M.string().min(3).max(20),
        email: M.string().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
        age: M.number().min(18).max(120),
        roles: M.array(M.string().enum(["user", "admin", "moderator"])),
        profile: M.object({
          firstName: M.string(),
          lastName: M.string(),
          bio: M.string().optional(),
        }),
        settings: M.object({
          theme: M.string().enum(["light", "dark"]).default("light"),
          notifications: M.boolean().default(true),
        }),
        createdAt: M.date(),
        updatedAt: M.date(),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema).toEqual({
        type: "object",
        properties: {
          _id: { type: "string", pattern: "^[a-f0-9]{24}$" },
          username: { type: "string", minLength: 3, maxLength: 20 },
          email: { type: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
          age: { type: "number", minimum: 18, maximum: 120 },
          roles: {
            type: "array",
            items: { type: "string", enum: ["user", "admin", "moderator"] },
          },
          profile: {
            type: "object",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              bio: { type: "string" },
            },
            required: ["firstName", "lastName"],
          },
          settings: {
            type: "object",
            properties: {
              theme: { type: "string", enum: ["light", "dark"], default: "light" },
              notifications: { type: "boolean", default: true },
            },
            required: ["theme", "notifications"],
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: [
          "_id",
          "username",
          "email",
          "age",
          "roles",
          "profile",
          "settings",
          "createdAt",
          "updatedAt",
        ],
      });
    });

    test("should convert e-commerce product schema", () => {
      const schema = M.schema({
        name: M.string(),
        price: M.decimal(),
        stock: M.number().min(0),
        tags: M.array(M.string()).min(1).max(10),
        variants: M.array(
          M.object({
            size: M.string(),
            color: M.string(),
            sku: M.string(),
          }),
        ),
        metadata: M.union(M.object({ key: M.string(), value: M.string() }), M.string()),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.price.type).toEqual("string");
      expect(jsonSchema.properties.stock).toEqual({ type: "number", minimum: 0 });
      expect(jsonSchema.properties.tags).toEqual({
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 10,
      });
      expect(jsonSchema.properties.variants).toEqual({
        type: "array",
        items: {
          type: "object",
          properties: {
            size: { type: "string" },
            color: { type: "string" },
            sku: { type: "string" },
          },
          required: ["size", "color", "sku"],
        },
      });
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty schema", () => {
      const schema = M.schema({});

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema).toEqual({
        type: "object",
        properties: {},
        required: [],
      });
    });

    test("should handle single field schema", () => {
      const schema = M.schema({
        id: M.string(),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema).toEqual({
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      });
    });

    test("should handle array of unions", () => {
      const schema = M.schema({
        items: M.array(M.union(M.string(), M.number())),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.items).toEqual({
        type: "array",
        items: {
          anyOf: [{ type: "string" }, { type: "number" }],
        },
      });
    });

    test("should handle tuple of objects", () => {
      const schema = M.schema({
        pair: M.tuple([M.object({ x: M.number() }), M.object({ y: M.number() })]),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.pair).toEqual({
        type: "array",
        items: [
          {
            type: "object",
            properties: { x: { type: "number" } },
            required: ["x"],
          },
          {
            type: "object",
            properties: { y: { type: "number" } },
            required: ["y"],
          },
        ],
        minItems: 2,
        maxItems: 2,
      });
    });

    test("should handle deeply nested structures", () => {
      const schema = M.schema({
        level1: M.object({
          level2: M.object({
            level3: M.object({
              level4: M.array(M.number()),
            }),
          }),
        }),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.level1.properties.level2.properties.level3).toEqual({
        type: "object",
        properties: {
          level4: {
            type: "array",
            items: { type: "number" },
          },
        },
        required: ["level4"],
      });
    });
  });

  describe("Special Patterns", () => {
    test("should handle multiple string patterns", () => {
      const schema = M.schema({
        email: M.string().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
        phone: M.string().match(/^\+?[1-9]\d{1,14}$/),
        uuid: M.string().match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.email.pattern).toBe("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
      expect(jsonSchema.properties.phone.pattern).toBe("^\\+?[1-9]\\d{1,14}$");
      expect(jsonSchema.properties.uuid.pattern).toBe(
        "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      );
    });

    test("should handle combined constraints", () => {
      const schema = M.schema({
        code: M.string()
          .min(5)
          .max(10)
          .match(/^[A-Z0-9]+$/),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.code).toEqual({
        type: "string",
        minLength: 5,
        maxLength: 10,
        pattern: "^[A-Z0-9]+$",
      });
    });

    test("should handle enum with default", () => {
      const schema = M.schema({
        status: M.string().enum(["draft", "published", "archived"]).default("draft"),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.status).toEqual({
        type: "string",
        enum: ["draft", "published", "archived"],
        default: "draft",
      });
    });
  });

  describe("Timestamps", () => {
    test("should not include timestamp fields in JSON schema by default", () => {
      const schema = M.schema({
        name: M.string(),
      }).withTimestamps();

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties).toEqual({
        name: { type: "string" },
      });
      expect(jsonSchema.required).toEqual(["name"]);
    });

    test("should include timestamp fields if explicitly added", () => {
      const schema = M.schema({
        name: M.string(),
        createdAt: M.date(),
        updatedAt: M.date(),
      });

      const jsonSchema = schema.getJsonSchema();

      expect(jsonSchema.properties.createdAt).toEqual({ type: "string", format: "date-time" });
      expect(jsonSchema.properties.updatedAt).toEqual({ type: "string", format: "date-time" });
    });
  });
});
