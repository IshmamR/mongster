import { describe, expect, expectTypeOf, test } from "bun:test";
import { ObjectId } from "mongodb";
import { SchemaError } from "../src/error";
import { MongsterSchemaBuilder } from "../src/schema";
import type { InferSchemaInputType } from "../src/types/types.schema";

const M = new MongsterSchemaBuilder();

describe("Deeply Nested Structures", () => {
  test("should handle complex nested array of objects with unions", () => {
    const schema = M.array(
      M.object({
        id: M.string(),
        data: M.union(
          M.object({
            type: M.string().enum(["text"]),
            content: M.string(),
            metadata: M.object({
              length: M.number(),
              words: M.array(M.string()),
            }).optional(),
          }),
          M.object({
            type: M.string().enum(["image"]),
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
    expect(result[0]?.active).toBe(true);
    expect(result[1]?.active).toBe(false);
    expect(result[0]?.data.type).toBe("text");
    expect(result[1]?.data.type).toBe("image");
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
    expect(result[0]?.type).toBe("user");
    expect((result[0] as any).profile.preferences.theme).toBe("light");
    expect(result[1]?.type).toBe("system");
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

    test("should handle SchemaError instances", () => {
      const schema = M.string();

      try {
        schema.parse(123);
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaError);
        expect((error as SchemaError).message).toBe("Expected a string");
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
