import { describe, expect, test } from "bun:test";
import { MongsterSchemaBuilder } from "../src/schema";

const M = new MongsterSchemaBuilder();

describe("Schema Index System", () => {
  describe("Basic field-level indexes", () => {
    test("should collect simple field indexes", () => {
      const schema = M.schema({
        name: M.string().index(),
        email: M.string().uniqueIndex(),
        status: M.string().sparseIndex(),
        tags: M.string().hashedIndex(),
        content: M.string().textIndex(),
        age: M.number().index(-1),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toHaveLength(6);

      expect(indexes).toContainEqual({
        key: { name: 1 },
      });

      expect(indexes).toContainEqual({
        key: { email: 1 },
        unique: true,
      });

      expect(indexes).toContainEqual({
        key: { status: 1 },
        sparse: true,
      });

      expect(indexes).toContainEqual({
        key: { tags: "hashed" },
      });

      expect(indexes).toContainEqual({
        key: { content: "text" },
      });

      expect(indexes).toContainEqual({
        key: { age: -1 },
      });
    });

    test("should validate MongoDB index direction values", () => {
      const schema = M.schema({
        ascending: M.string().index(1),
        descending: M.number().index(-1),
        hashed: M.string().hashedIndex(),
        text: M.string().textIndex(),
      });

      const indexes = schema.collectIndexes();

      indexes.forEach((index) => {
        if (typeof index === "object" && index !== null && "key" in index && index.key) {
          Object.values(index.key).forEach((direction) => {
            expect([1, -1, "hashed", "text"]).toContain(direction);
          });
        }
      });

      expect(indexes).toContainEqual({
        key: { ascending: 1 },
      });
      expect(indexes).toContainEqual({
        key: { descending: -1 },
      });
      expect(indexes).toContainEqual({
        key: { hashed: "hashed" },
      });
      expect(indexes).toContainEqual({
        key: { text: "text" },
      });
    });

    test("should handle multiple index options on same field", () => {
      const schema = M.schema({
        field1: M.string().index().uniqueIndex().sparseIndex(),
        field2: M.number().index(-1).sparseIndex(),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { field1: 1 },
        unique: true,
        sparse: true,
      });

      expect(indexes).toContainEqual({
        key: { field2: -1 },
        sparse: true,
      });
    });

    test("should collect partial indexes with filter expressions", () => {
      const schema = M.schema({
        status: M.string().partialIndex({ status: { $ne: "deleted" } }),
        active: M.boolean().partialIndex({ active: true }),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { status: 1 },
        partialFilterExpression: { status: { $ne: "deleted" } },
      });

      expect(indexes).toContainEqual({
        key: { active: 1 },
        partialFilterExpression: { active: true },
      });
    });
  });

  describe("TTL indexes on date fields", () => {
    test("should collect TTL indexes with expireAfterSeconds", () => {
      const schema = M.schema({
        createdAt: M.date().ttl(86400),
        sessionExpiry: M.date().expires(3600),
        logEntry: M.date().ttl(604800).index(),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { createdAt: 1 },
        expireAfterSeconds: 86400,
      });

      expect(indexes).toContainEqual({
        key: { sessionExpiry: 1 },
        expireAfterSeconds: 3600,
      });

      expect(indexes).toContainEqual({
        key: { logEntry: 1 },
        expireAfterSeconds: 604800,
      });
    });

    test("should collect TTL indexes with other index options", () => {
      const schema = M.schema({
        timestamp: M.date().ttl(3600).uniqueIndex().sparseIndex(),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { timestamp: 1 },
        expireAfterSeconds: 3600,
        unique: true,
        sparse: true,
      });
    });
  });

  describe("Nested object indexes", () => {
    test("should collect indexes from nested objects with dot notation", () => {
      const schema = M.schema({
        user: M.object({
          profile: M.object({
            name: M.string().index(),
            email: M.string().uniqueIndex(),
          }),
          settings: M.object({
            theme: M.string().index(),
            notifications: M.boolean().sparseIndex(),
          }),
        }),
        metadata: M.object({
          tags: M.array(M.string()).index(),
        }),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { "user.profile.name": 1 },
      });

      expect(indexes).toContainEqual({
        key: { "user.profile.email": 1 },
        unique: true,
      });

      expect(indexes).toContainEqual({
        key: { "user.settings.theme": 1 },
      });

      expect(indexes).toContainEqual({
        key: { "user.settings.notifications": 1 },
        sparse: true,
      });

      expect(indexes).toContainEqual({
        key: { "metadata.tags": 1 },
      });
    });

    test("should handle deeply nested objects", () => {
      const schema = M.schema({
        data: M.object({
          level1: M.object({
            level2: M.object({
              level3: M.object({
                value: M.string().textIndex(),
                score: M.number().index(-1),
              }),
            }),
          }),
        }),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { "data.level1.level2.level3.value": "text" },
      });

      expect(indexes).toContainEqual({
        key: { "data.level1.level2.level3.score": -1 },
      });
    });
  });

  describe("Array element indexes", () => {
    test("should collect indexes from array element schemas", () => {
      const schema = M.schema({
        tags: M.array(M.string().index()),
        scores: M.array(M.number().index(-1)),
        items: M.array(
          M.object({
            name: M.string().textIndex(),
            priority: M.number().sparseIndex(),
          }),
        ),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { tags: 1 },
      });

      expect(indexes).toContainEqual({
        key: { scores: -1 },
      });

      expect(indexes).toContainEqual({
        key: { "items.name": "text" },
      });

      expect(indexes).toContainEqual({
        key: { "items.priority": 1 },
        sparse: true,
      });
    });

    test("should handle nested arrays", () => {
      const schema = M.schema({
        matrix: M.array(M.array(M.number().index())),
        complex: M.array(
          M.object({
            nested: M.array(M.string().hashedIndex()),
          }),
        ),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { matrix: 1 },
      });

      expect(indexes).toContainEqual({
        key: { "complex.nested": "hashed" },
      });
    });
  });

  describe("Root-level createIndex", () => {
    test("should collect compound indexes created with createIndex", () => {
      const schema = M.schema({
        name: M.string(),
        age: M.number(),
        status: M.string(),
        createdAt: M.date(),
      })
        .addIndex({ name: 1, age: -1 })
        .addIndex({ status: 1, createdAt: -1 }, { unique: true })
        .addIndex(
          { name: "text", status: 1 },
          {
            sparse: true,
            name: "custom_compound_index",
          },
        );

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { name: 1, age: -1 },
      });

      expect(indexes).toContainEqual({
        key: { status: 1, createdAt: -1 },
        unique: true,
      });

      expect(indexes).toContainEqual({
        key: { name: "text", status: 1 },
        sparse: true,
        name: "custom_compound_index",
      });
    });

    test("should combine field-level and root-level indexes", () => {
      const schema = M.schema({
        name: M.string().index(),
        email: M.string().uniqueIndex(),
        age: M.number(),
        status: M.string(),
      })
        .addIndex({ age: 1, status: 1 })
        .addIndex({ email: 1, name: 1 });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { name: 1 },
      });

      expect(indexes).toContainEqual({
        key: { email: 1 },
        unique: true,
      });

      expect(indexes).toContainEqual({
        key: { age: 1, status: 1 },
      });

      expect(indexes).toContainEqual({
        key: { email: 1, name: 1 },
      });
    });
  });

  describe("Wrapper schema indexes", () => {
    test("should collect indexes through optional and nullable wrappers", () => {
      const schema = M.schema({
        optionalName: M.string().index().optional(),
        nullableEmail: M.string().uniqueIndex().nullable(),
        optionalNullableStatus: M.string().sparseIndex().optional().nullable(),
        nullableOptionalTags: M.string().hashedIndex().nullable().optional(),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { optionalName: 1 },
      });

      expect(indexes).toContainEqual({
        key: { nullableEmail: 1 },
        unique: true,
      });

      expect(indexes).toContainEqual({
        key: { optionalNullableStatus: 1 },
        sparse: true,
      });

      expect(indexes).toContainEqual({
        key: { nullableOptionalTags: "hashed" },
      });
    });

    test("should collect indexes through array wrappers", () => {
      const schema = M.schema({
        stringArray: M.string().textIndex().array(),
        nestedArray: M.object({
          value: M.number().index(),
        }).array(),
        complexArray: M.string().uniqueIndex().optional().array(),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { stringArray: "text" },
      });

      expect(indexes).toContainEqual({
        key: { "nestedArray.value": 1 },
      });

      expect(indexes).toContainEqual({
        key: { complexArray: 1 },
        unique: true,
      });
    });

    test("should collect indexes through validation wrappers", () => {
      const schema = M.schema({
        validatedEmail: M.string()
          .uniqueIndex()
          .validate((email) => email.includes("@")),
        validatedAge: M.number()
          .index()
          .validate((age) => age >= 0, "Age must be positive")
          .optional(),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { validatedEmail: 1 },
        unique: true,
      });

      expect(indexes).toContainEqual({
        key: { validatedAge: 1 },
      });
    });
  });

  describe("Nested MongsterSchema indexes", () => {
    test("should collect indexes from nested MongsterSchema instances", () => {
      const userSchema = M.object({
        name: M.string().index(),
        email: M.string().uniqueIndex(),
      }).addIndex({ name: 1, email: 1 });

      const addressSchema = M.object({
        street: M.string().textIndex(),
        city: M.string().index(),
        zipCode: M.string().sparseIndex(),
      })
        .addIndex({ city: 1, zipCode: 1 })
        .addIndex({ zipCode: 1, street: 1 });

      const mainSchema = M.schema({
        user: userSchema,
        address: addressSchema,
        metadata: M.object({
          nested: userSchema,
        }),
      });

      const indexes = mainSchema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { "user.name": 1 },
      });

      expect(indexes).toContainEqual({
        key: { "user.email": 1 },
        unique: true,
      });

      expect(indexes).toContainEqual({
        key: { "user.name": 1, "user.email": 1 },
      });

      expect(indexes).toContainEqual({
        key: { "address.street": "text" },
      });

      expect(indexes).toContainEqual({
        key: { "address.city": 1 },
      });

      expect(indexes).toContainEqual({
        key: { "address.zipCode": 1 },
        sparse: true,
      });

      expect(indexes).toContainEqual({
        key: { "address.city": 1, "address.zipCode": 1 },
      });

      expect(indexes).toContainEqual({
        key: { "address.street": 1, "address.zipCode": 1 },
      });

      expect(indexes).toContainEqual({
        key: { "metadata.nested.name": 1 },
      });

      expect(indexes).toContainEqual({
        key: { "metadata.nested.email": 1 },
        unique: true,
      });
    });
  });

  describe("Complex mixed scenarios", () => {
    test("should handle complex schema with all index types", () => {
      const schema = M.schema({
        _id: M.objectId(),
        title: M.string().textIndex(),
        slug: M.string().uniqueIndex().sparseIndex(),
        author: M.object({
          name: M.string().index(),
          email: M.string().uniqueIndex(),
          profile: M.object({
            bio: M.string().textIndex(),
            skills: M.array(M.string().index()),
          }),
        }),
        tags: M.array(M.string().hashedIndex()),
        metadata: M.object({
          views: M.number().index(-1),
          likes: M.number().sparseIndex(),
          comments: M.array(
            M.object({
              author: M.string().index(),
              content: M.string().textIndex(),
              timestamp: M.date().ttl(2592000),
            }),
          ),
        }),
        publishedAt: M.date().index(),
        expiredAt: M.date().ttl(86400).optional(),
        status: M.string()
          .enum(["draft", "published", "archived"])
          .index()
          .validate((status) => ["draft", "published", "archived"].includes(status)),
      })
        .addIndex({ title: "text", "author.name": 1 })
        .addIndex(
          { publishedAt: -1, status: 1 },
          {
            partialFilterExpression: { status: "published" },
          },
        )
        .addIndex({ slug: 1 }, { unique: true, sparse: true });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { title: "text" },
      });

      expect(indexes).toContainEqual({
        key: { slug: 1 },
        unique: true,
        sparse: true,
      });

      expect(indexes).toContainEqual({
        key: { "author.name": 1 },
      });

      expect(indexes).toContainEqual({
        key: { "author.email": 1 },
        unique: true,
      });

      expect(indexes).toContainEqual({
        key: { "author.profile.bio": "text" },
      });

      expect(indexes).toContainEqual({
        key: { "author.profile.skills": 1 },
      });

      expect(indexes).toContainEqual({
        key: { tags: "hashed" },
      });

      expect(indexes).toContainEqual({
        key: { "metadata.views": -1 },
      });

      expect(indexes).toContainEqual({
        key: { "metadata.likes": 1 },
        sparse: true,
      });

      expect(indexes).toContainEqual({
        key: { "metadata.comments.author": 1 },
      });

      expect(indexes).toContainEqual({
        key: { "metadata.comments.content": "text" },
      });

      expect(indexes).toContainEqual({
        key: { "metadata.comments.timestamp": 1 },
        expireAfterSeconds: 2592000,
      });

      expect(indexes).toContainEqual({
        key: { publishedAt: 1 },
      });

      expect(indexes).toContainEqual({
        key: { expiredAt: 1 },
        expireAfterSeconds: 86400,
      });

      expect(indexes).toContainEqual({
        key: { status: 1 },
      });

      expect(indexes).toContainEqual({
        key: { title: "text", "author.name": 1 },
      });

      expect(indexes).toContainEqual({
        key: { publishedAt: -1, status: 1 },
        partialFilterExpression: { status: "published" },
      });

      expect(indexes).toContainEqual({
        key: { slug: 1 },
        unique: true,
        sparse: true,
      });
    });

    test("should handle edge cases and potential duplicates", () => {
      const schema = M.schema({
        name: M.string().index().uniqueIndex(),
        email: M.string().index(),
      })
        .addIndex({ name: 1 })
        .addIndex({ email: 1, name: 1 })
        .addIndex({ email: 1, name: 1 });

      const indexes = schema.collectIndexes();

      expect(indexes.length).toBeGreaterThan(0);

      expect(indexes).toContainEqual({
        key: { email: 1, name: 1 },
      });
    });
  });

  describe("MongoDB Index Format Validation", () => {
    test("should generate valid MongoDB IndexSpecification format", () => {
      const schema = M.schema({
        name: M.string().uniqueIndex().sparseIndex(),
        age: M.number().index(-1),
        tags: M.array(M.string()).hashedIndex(),
        content: M.string().textIndex(),
        createdAt: M.date().ttl(3600),
      })
        .addIndex({ name: 1, age: -1 }, { unique: true, background: true })
        .addIndex({ tags: "hashed", content: "text" });

      const indexes = schema.collectIndexes();

      indexes.forEach((index) => {
        expect(typeof index).toBe("object");
        expect(index).not.toBeNull();

        if (typeof index === "object" && "key" in index) {
          expect(index.key).toBeDefined();
          expect(typeof index.key).toBe("object");

          Object.values(index.key).forEach((direction) => {
            expect([1, -1, "hashed", "text"]).toContain(direction);
          });

          const validOptions = [
            "unique",
            "sparse",
            "background",
            "partialFilterExpression",
            "expireAfterSeconds",
            "name",
            "weights",
            "default_language",
            "language_override",
            "textIndexVersion",
            "2dsphereIndexVersion",
            "bits",
            "min",
            "max",
            "bucketSize",
            "wildcardProjection",
            "hidden",
            "commitQuorum",
            "version",
            "storageEngine",
          ];

          Object.keys(index as any).forEach((key) => {
            if (key !== "key") {
              expect(validOptions).toContain(key);
            }
          });
        }
      });
    });

    test("should handle compound indexes correctly", () => {
      const schema = M.schema({
        userId: M.string(),
        timestamp: M.date(),
        status: M.string(),
      })
        .addIndex({ userId: 1, timestamp: -1 })
        .addIndex({ status: 1, userId: 1, timestamp: -1 }, { sparse: true });

      const indexes = schema.collectIndexes();

      const compoundIndexes = indexes.filter(
        (index) =>
          typeof index === "object" &&
          index !== null &&
          "key" in index &&
          Object.keys((index as any).key).length > 1,
      );

      expect(compoundIndexes.length).toBeGreaterThanOrEqual(2);

      expect(indexes).toContainEqual({
        key: { userId: 1, timestamp: -1 },
      });

      expect(indexes).toContainEqual({
        key: { status: 1, userId: 1, timestamp: -1 },
        sparse: true,
      });
    });

    test("should preserve index option types correctly", () => {
      const schema = M.schema({
        field1: M.string().partialIndex({ field1: { $exists: true } }),
        field2: M.date().ttl(86400),
        field3: M.string().index(),
      }).addIndex(
        { field3: 1 },
        {
          unique: true,
          sparse: false,
          background: true,
          name: "custom_index_name",
          expireAfterSeconds: 3600,
        },
      );

      const indexes = schema.collectIndexes();

      // Check that boolean options remain boolean
      const customIndex = indexes.find(
        (index) =>
          typeof index === "object" &&
          index !== null &&
          "name" in index &&
          (index as any).name === "custom_index_name",
      ) as any;

      if (customIndex) {
        expect(customIndex.unique).toBe(true);
        expect(customIndex.sparse).toBe(false);
        expect(customIndex.background).toBe(true);
        expect(customIndex.expireAfterSeconds).toBe(3600);
        expect(customIndex.name).toBe("custom_index_name");
      }

      // Check TTL index
      const ttlIndex = indexes.find(
        (index) =>
          typeof index === "object" &&
          index !== null &&
          "expireAfterSeconds" in index &&
          (index as any).expireAfterSeconds === 86400,
      ) as any;
      expect(ttlIndex).toBeDefined();
      if (ttlIndex) {
        expect(typeof ttlIndex.expireAfterSeconds).toBe("number");
      }

      // Check partial filter expression
      const partialIndex = indexes.find(
        (index) =>
          typeof index === "object" && index !== null && "partialFilterExpression" in index,
      ) as any;
      expect(partialIndex).toBeDefined();
      if (partialIndex) {
        expect(typeof partialIndex.partialFilterExpression).toBe("object");
      }
    });
  });

  describe("Error cases and edge conditions", () => {
    test("should handle empty schema", () => {
      const schema = M.schema({});
      const indexes = schema.collectIndexes();
      expect(indexes).toEqual([]);
    });

    test("should handle schema with no indexes", () => {
      const schema = M.schema({
        name: M.string(),
        age: M.number(),
        active: M.boolean(),
      });

      const indexes = schema.collectIndexes();
      expect(indexes).toEqual([]);
    });

    test("should handle union schemas (might not support indexes)", () => {
      const schema = M.schema({
        data: M.union(M.string().index(), M.number().index()),
      });

      expect(() => {
        const indexes = schema.collectIndexes();
        expect(Array.isArray(indexes)).toBe(true);
      }).not.toThrow();
    });

    test("should handle tuple schemas (might not support indexes)", () => {
      const schema = M.schema({
        coordinates: M.tuple([M.number().index(), M.number().index()]),
      });

      expect(() => {
        const indexes = schema.collectIndexes();
        expect(Array.isArray(indexes)).toBe(true);
      }).not.toThrow();
    });

    test("should handle very deeply nested structures", () => {
      const schema = M.schema({
        level1: M.object({
          level2: M.object({
            level3: M.object({
              level4: M.object({
                level5: M.object({
                  level6: M.object({
                    deepField: M.string().textIndex(),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const indexes = schema.collectIndexes();

      expect(indexes).toContainEqual({
        key: { "level1.level2.level3.level4.level5.level6.deepField": "text" },
      });
    });

    test("should handle circular reference prevention", () => {
      const schema = M.schema({
        data: M.array(
          M.object({
            nested: M.array(
              M.object({
                value: M.string().index(),
                metadata: M.object({
                  tags: M.array(M.string().hashedIndex()),
                }),
              }),
            ),
          }),
        ),
      });

      expect(() => {
        const indexes = schema.collectIndexes();
        expect(Array.isArray(indexes)).toBe(true);
        expect(indexes.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    test("should handle invalid index combinations gracefully", () => {
      const schema = M.schema({
        field1: M.string().textIndex().hashedIndex(),
        field2: M.number().index(1).index(-1),
      });

      expect(() => {
        const indexes = schema.collectIndexes();
        expect(Array.isArray(indexes)).toBe(true);

        indexes.forEach((index) => {
          if (typeof index === "object" && index !== null && "key" in index && index.key) {
            Object.values(index.key).forEach((direction) => {
              expect([1, -1, "hashed", "text"]).toContain(direction);
            });
          }
        });
      }).not.toThrow();
    });
  });
});
