import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongsterClient } from "../src/client";
import { ValidationError } from "../src/error";
import { MongsterSchemaBuilder } from "../src/schema";

const M = new MongsterSchemaBuilder();

let mongod: MongoMemoryServer | null = null;
let client: MongsterClient;

describe("parseForUpdate Method Validation", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongsterClient();
    await client.connect(mongod.getUri(), {});
  });

  afterAll(async () => {
    await client.disconnect();
    await mongod?.stop();
  });

  describe("Invalid Update Operators", () => {
    test("should reject non-existent update operators", async () => {
      const schema = M.schema({ name: M.string(), age: M.number() });

      const Model = client.model("invalid_operator_test", schema);

      // @ts-expect-error - intentionally invalid operator
      expect(() => Model.updateOne({}, { $invalid: { name: "test" } })).toThrow(ValidationError);
    });

    test("should reject misspelled update operators", async () => {
      const schema = M.schema({ counter: M.number() });

      const Model = client.model("misspelled_operator_test", schema);

      // @ts-expect-error - intentionally misspelled
      expect(() => Model.updateOne({}, { $increment: { counter: 1 } })).toThrow(ValidationError);
    });

    test("should reject multiple invalid operators", async () => {
      const schema = M.schema({ name: M.string() });

      const Model = client.model("multiple_invalid_test", schema);

      expect(() =>
        // @ts-expect-error - intentionally invalid
        Model.updateOne({}, { $invalid1: { name: "a" }, $invalid2: { name: "b" } }),
      ).toThrow(ValidationError);
    });
  });

  describe("Nested Field Validation - $set", () => {
    test("should validate nested object field types with $set", async () => {
      const schema = M.schema({
        profile: M.object({
          name: M.string(),
          age: M.number(),
        }),
      });

      const Model = client.model("nested_set_validation_test", schema);

      expect(async () => {
        await Model.updateOne({}, { $set: { "profile.age": "not a number" as any } });
      }).toThrow(ValidationError);
    });

    test("should validate deeply nested field types with $set", async () => {
      const schema = M.schema({
        user: M.object({
          profile: M.object({
            settings: M.object({
              theme: M.string(),
              notifications: M.boolean(),
            }),
          }),
        }),
      });

      const Model = client.model("deeply_nested_set_test", schema);

      // Should fail: setting boolean field to string
      expect(() =>
        Model.updateOne({}, { $set: { "user.profile.settings.notifications": "yes" as any } }),
      ).toThrow();
    });

    test("should reject $set on non-existent nested fields", async () => {
      const schema = M.schema({
        profile: M.object({
          name: M.string(),
        }),
      });

      const Model = client.model("nonexistent_nested_field_test", schema);

      // Should fail: 'age' doesn't exist in profile
      expect(() => Model.updateOne({}, { $set: { "profile.age": 30 } as any })).toThrow();
    });

    test("should reject $set on non-existent top-level fields", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const Model = client.model("nonexistent_toplevel_field_test", schema);

      // Should fail: 'age' doesn't exist in schema
      expect(() => Model.updateOne({}, { $set: { age: 30 } as any })).toThrow();
    });

    test("should validate $set with array element updates", async () => {
      const schema = M.schema({
        tags: M.array(M.string()),
      });

      const Model = client.model("array_element_set_test", schema);

      // Should fail: setting array element to number instead of string
      // Note: TypeScript doesn't support positional operators in types, so we bypass type checking
      expect(() => (Model as any).updateOne({}, { $set: { "tags.0": 123 } })).toThrow();
    });

    test("should validate $set with nested array field updates", async () => {
      const schema = M.schema({
        users: M.array(
          M.object({
            name: M.string(),
            age: M.number(),
          }),
        ),
      });

      const Model = client.model("nested_array_set_test", schema);

      // Should fail: setting age to string in array element
      expect(() => Model.updateOne({}, { $set: { "users.0.age": "thirty" as any } })).toThrow();
    });

    test("should enforce enum constraints on nested $set", async () => {
      const schema = M.schema({
        settings: M.object({
          theme: M.string().enum(["light", "dark", "auto"]),
        }),
      });

      const Model = client.model("nested_enum_set_test", schema);

      // Should fail: 'blue' is not in enum
      expect(() => Model.updateOne({}, { $set: { "settings.theme": "blue" as any } })).toThrow();
    });

    test("should enforce min/max constraints on nested $set", async () => {
      const schema = M.schema({
        limits: M.object({
          maxUsers: M.number().min(1).max(100),
        }),
      });

      const Model = client.model("nested_minmax_set_test", schema);

      // Should fail: exceeds max
      expect(() => Model.updateOne({}, { $set: { "limits.maxUsers": 200 } })).toThrow();

      // Should fail: below min
      expect(() => Model.updateOne({}, { $set: { "limits.maxUsers": 0 } })).toThrow();
    });

    test("should enforce string length constraints on nested $set", async () => {
      const schema = M.schema({
        user: M.object({
          username: M.string().min(3).max(20),
        }),
      });

      const Model = client.model("nested_string_length_set_test", schema);

      // Should fail: too short
      expect(() => Model.updateOne({}, { $set: { "user.username": "ab" } })).toThrow();

      // Should fail: too long
      expect(() => Model.updateOne({}, { $set: { "user.username": "a".repeat(21) } })).toThrow();
    });

    test("should handle optional nested fields correctly with $set", async () => {
      const schema = M.schema({
        profile: M.object({
          bio: M.string().optional(),
          age: M.number(),
        }),
      });

      const Model = client.model("optional_nested_set_test", schema);

      // Should fail: can't set optional field to undefined (must use $unset)
      expect(() => Model.updateOne({}, { $set: { "profile.bio": undefined as any } })).toThrow();
    });
  });

  describe("Nested Field Validation - $inc", () => {
    test("should validate $inc on nested numeric fields", async () => {
      const schema = M.schema({
        stats: M.object({
          views: M.number(),
        }),
      });

      const Model = client.model("nested_inc_test", schema);

      // Should fail: can't increment string field
      expect(() => Model.updateOne({}, { $inc: { "stats.views": "5" as any } })).toThrow(
        "$inc.stats.views must be a number",
      );
    });

    test("should reject $inc on non-numeric nested fields", async () => {
      const schema = M.schema({
        profile: M.object({
          name: M.string(),
        }),
      });

      const Model = client.model("inc_string_field_test", schema);

      // Should fail: can't increment a string field
      expect(() => Model.updateOne({}, { $inc: { "profile.name": 1 } as any })).toThrow();
    });

    test("should reject $inc on non-existent nested fields", async () => {
      const schema = M.schema({
        stats: M.object({
          views: M.number(),
        }),
      });

      const Model = client.model("inc_nonexistent_nested_test", schema);

      // Should fail: 'likes' doesn't exist in stats
      expect(() => Model.updateOne({}, { $inc: { "stats.likes": 1 } as any })).toThrow();
    });
  });

  describe("Nested Field Validation - $mul", () => {
    test("should validate $mul on nested numeric fields", async () => {
      const schema = M.schema({
        pricing: M.object({
          factor: M.number(),
        }),
      });

      const Model = client.model("nested_mul_test", schema);

      // Should fail: multiplier must be a number
      expect(() => Model.updateOne({}, { $mul: { "pricing.factor": "2" as any } })).toThrow(
        "$mul.pricing.factor must be a number",
      );
    });

    test("should reject $mul on non-numeric nested fields", async () => {
      const schema = M.schema({
        data: M.object({
          label: M.string(),
        }),
      });

      const Model = client.model("mul_string_field_test", schema);

      // Should fail: can't multiply a string field
      expect(() => Model.updateOne({}, { $mul: { "data.label": 2 } as any })).toThrow();
    });
  });

  describe("Nested Field Validation - $min and $max", () => {
    test("should validate $min type matches nested field type", async () => {
      const schema = M.schema({
        metrics: M.object({
          score: M.number(),
        }),
      });

      const Model = client.model("nested_min_type_test", schema);

      // Should fail: $min value must match field type
      expect(() => Model.updateOne({}, { $min: { "metrics.score": "100" as any } })).toThrow();
    });

    test("should validate $max type matches nested field type", async () => {
      const schema = M.schema({
        metrics: M.object({
          score: M.number(),
        }),
      });

      const Model = client.model("nested_max_type_test", schema);

      // Should fail: $max value must match field type
      expect(() => Model.updateOne({}, { $max: { "metrics.score": "100" as any } })).toThrow();
    });

    test("should reject $min on non-existent nested fields", async () => {
      const schema = M.schema({
        metrics: M.object({
          score: M.number(),
        }),
      });

      const Model = client.model("min_nonexistent_test", schema);

      // Should fail: 'rating' doesn't exist
      expect(() => Model.updateOne({}, { $min: { "metrics.rating": 50 } as any })).toThrow();
    });
  });

  describe("Nested Field Validation - $unset", () => {
    test("should reject $unset on required nested fields", async () => {
      const schema = M.schema({
        profile: M.object({
          name: M.string(),
        }),
      });

      const Model = client.model("unset_required_nested_test", schema);

      // Should fail: can't unset required field
      expect(() => Model.updateOne({}, { $unset: { "profile.name": "" } as any })).toThrow();
    });

    test("should allow $unset only on optional nested fields", async () => {
      const schema = M.schema({
        profile: M.object({
          bio: M.string().optional(),
          name: M.string(),
        }),
      });

      const Model = client.model("unset_optional_nested_test", schema);

      const doc = await Model.createOne({ profile: { bio: "test bio", name: "John" } });

      // Should pass: unsetting optional field
      // Note: This will currently NOT validate properly, which is the point of this test
      // When implemented, it should validate correctly
      await Model.updateOne({ _id: doc?._id }, { $unset: { "profile.bio": "" } as any });

      // Should fail: can't unset required field when proper validation is implemented
      expect(() =>
        Model.updateOne({ _id: doc?._id }, { $unset: { "profile.name": "" } as any }),
      ).toThrow();
    });

    test("should reject $unset on non-existent nested fields", async () => {
      const schema = M.schema({
        profile: M.object({
          name: M.string(),
        }),
      });

      const Model = client.model("unset_nonexistent_test", schema);

      // Should fail: field doesn't exist
      expect(() => Model.updateOne({}, { $unset: { "profile.age": "" } as any })).toThrow();
    });
  });

  describe("Array Operation Validation", () => {
    test("should validate $push value type matches array element type", async () => {
      const schema = M.schema({
        tags: M.array(M.string()),
      });

      const Model = client.model("push_type_test", schema);

      // Should fail: pushing number to string array
      expect(() => Model.updateOne({}, { $push: { tags: 123 } as any })).toThrow();
    });

    test("should validate $push on nested array fields", async () => {
      const schema = M.schema({
        user: M.object({
          hobbies: M.array(M.string()),
        }),
      });

      const Model = client.model("nested_push_test", schema);

      // Should fail: pushing wrong type to nested array
      expect(() => Model.updateOne({}, { $push: { "user.hobbies": 123 } as any })).toThrow();
    });

    test("should validate $addToSet value type matches array element type", async () => {
      const schema = M.schema({
        categories: M.array(M.string()),
      });

      const Model = client.model("addtoset_type_test", schema);

      // Should fail: adding number to string array
      expect(() => Model.updateOne({}, { $addToSet: { categories: 123 } as any })).toThrow();
    });

    test("should validate $pull value type matches array element type", async () => {
      const schema = M.schema({
        numbers: M.array(M.number()),
      });

      const Model = client.model("pull_type_test", schema);

      // Should fail: pulling string from number array
      expect(() => Model.updateOne({}, { $pull: { numbers: "5" } as any })).toThrow();
    });

    test("should validate $pullAll values match array element type", async () => {
      const schema = M.schema({
        scores: M.array(M.number()),
      });

      const Model = client.model("pullall_type_test", schema);

      // Should fail: pulling strings from number array
      expect(() => Model.updateOne({}, { $pullAll: { scores: ["1", "2"] } as any })).toThrow();
    });

    test("should reject array operators on non-array fields", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const Model = client.model("push_non_array_test", schema);

      // Should fail: can't push to non-array field
      expect(() => Model.updateOne({}, { $push: { name: "value" } as any })).toThrow();
    });

    test("should reject $pop on non-array nested fields", async () => {
      const schema = M.schema({
        user: M.object({
          name: M.string(),
        }),
      });

      const Model = client.model("pop_non_array_test", schema);

      // Should fail: can't pop from non-array field
      expect(() => Model.updateOne({}, { $pop: { "user.name": 1 } as any })).toThrow();
    });
  });

  describe("$rename Validation", () => {
    test("should validate $rename source and target fields exist", async () => {
      const schema = M.schema({
        oldName: M.string(),
        newName: M.string().optional(),
      });

      const Model = client.model("rename_validation_test", schema);

      // Should fail: can't rename from non-existent field
      expect(() => Model.updateOne({}, { $rename: { nonexistent: "newName" } as any })).toThrow();
    });

    test("should validate $rename target field types match", async () => {
      const schema = M.schema({
        stringField: M.string(),
        numberField: M.number(),
      });

      const Model = client.model("rename_type_mismatch_test", schema);

      // Should fail: can't rename string field to number field
      expect(() =>
        Model.updateOne({}, { $rename: { stringField: "numberField" } as any }),
      ).toThrow();
    });

    test("should reject $rename on nested fields with type mismatch", async () => {
      const schema = M.schema({
        user: M.object({
          firstName: M.string(),
          age: M.number(),
        }),
      });

      const Model = client.model("nested_rename_test", schema);

      // Should fail: can't rename string to number field
      expect(() =>
        Model.updateOne({}, { $rename: { "user.firstName": "user.age" } as any }),
      ).toThrow();
    });
  });

  describe("$currentDate Validation", () => {
    test("should reject $currentDate on non-date fields", async () => {
      const schema = M.schema({
        name: M.string(),
        updatedAt: M.date(),
      });

      const Model = client.model("currentdate_validation_test", schema);

      // Should fail: can't set current date on string field
      expect(() => Model.updateOne({}, { $currentDate: { name: true } as any })).toThrow();
    });

    test("should reject $currentDate on nested non-date fields", async () => {
      const schema = M.schema({
        metadata: M.object({
          label: M.string(),
          timestamp: M.date(),
        }),
      });

      const Model = client.model("nested_currentdate_test", schema);

      // Should fail: can't set current date on string field
      expect(() =>
        Model.updateOne({}, { $currentDate: { "metadata.label": true } as any }),
      ).toThrow();
    });
  });

  describe("Multiple Operator Validation", () => {
    test("should validate all operators in a single update", async () => {
      const schema = M.schema({
        name: M.string(),
        age: M.number(),
        tags: M.array(M.string()),
      });

      const Model = client.model("multiple_operator_test", schema);

      // Should fail: $inc has wrong type
      expect(() =>
        Model.updateOne(
          {},
          {
            $set: { name: "John" },
            $inc: { age: "5" as any },
            $push: { tags: "new" },
          },
        ),
      ).toThrow();
    });

    test("should catch type errors in any operator when multiple are used", async () => {
      const schema = M.schema({
        counter: M.number(),
        scores: M.array(M.number()),
      });

      const Model = client.model("multi_op_validation_test", schema);

      // Should fail: $push has wrong type
      expect(() =>
        Model.updateOne(
          {},
          {
            $inc: { counter: 1 },
            $push: { scores: "wrong" as any },
          },
        ),
      ).toThrow();
    });
  });

  describe("Complex Nested Structures", () => {
    test("should validate updates on deeply nested arrays", async () => {
      const schema = M.schema({
        data: M.array(
          M.array(
            M.object({
              value: M.number(),
            }),
          ),
        ),
      });

      const Model = client.model("deep_nested_array_test", schema);

      // Should fail: wrong type for deeply nested field
      expect(() =>
        Model.updateOne({}, { $set: { "data.0.0.value": "not a number" as any } }),
      ).toThrow();
    });

    test("should validate updates on nested union types", async () => {
      const schema = M.schema({
        field: M.union(M.string(), M.number()),
      });

      const Model = client.model("union_update_test", schema);

      // Should fail: boolean is not in union
      expect(() => Model.updateOne({}, { $set: { field: true as any } })).toThrow();
    });

    test("should validate updates on nested tuple types", async () => {
      const schema = M.schema({
        coordinates: M.tuple([M.number(), M.number()]),
      });

      const Model = client.model("tuple_update_test", schema);

      // Should fail: can't set tuple element to string
      expect(() => Model.updateOne({}, { $set: { "coordinates.0": "x" as any } })).toThrow();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("should reject empty update objects", async () => {
      const schema = M.schema({
        name: M.string(),
      });

      const Model = client.model("empty_update_test", schema);

      // Should throw for empty update - MongoDB requires at least one operator
      await expect(Model.updateOne({}, {})).rejects.toThrow();
    });

    test("should validate with timestamps enabled", async () => {
      const schema = M.schema({
        name: M.string(),
        age: M.number(),
      }).withTimestamps();

      const Model = client.model("timestamps_validation_test", schema);

      await Model.createOne({ name: "initial", age: 20 });

      // Should fail: wrong type
      expect(() => Model.updateOne({}, { $set: { age: "thirty" as any } })).toThrow();

      // Should automatically add updatedAt when implemented properly
      await Model.updateOne({}, { $set: { name: "test" } });
      // When implemented, should verify $currentDate was added for updatedAt
    });

    test("should validate on upsert operations", async () => {
      const schema = M.schema({
        key: M.string(),
        value: M.number().min(0).max(100),
      });

      const Model = client.model("upsert_validation_test", schema);

      // Should fail: value exceeds max even on upsert
      expect(() =>
        Model.updateOne({ key: "test" }, { $set: { value: 200 } }, { upsert: true }),
      ).toThrow();
    });

    test("should validate $setOnInsert fields", async () => {
      const schema = M.schema({
        id: M.string(),
        createdBy: M.string(),
        value: M.number(),
      });

      const Model = client.model("setoninsert_validation_test", schema);

      // Should fail: wrong type in $setOnInsert
      expect(() =>
        Model.updateOne(
          { id: "test" },
          { $setOnInsert: { createdBy: 123 as any } },
          { upsert: true },
        ),
      ).toThrow();
    });

    test("should handle null and undefined correctly in updates", async () => {
      const schema = M.schema({
        nullableField: M.string().nullable(),
        optionalField: M.string().optional(),
      });

      const Model = client.model("null_undefined_update_test", schema);

      await Model.createOne({ nullableField: "test", optionalField: "optional" });

      // Should pass: setting nullable field to null
      await Model.updateOne({}, { $set: { nullableField: null } });

      // Should fail: can't set field to undefined (must use $unset)
      expect(() => Model.updateOne({}, { $set: { optionalField: undefined as any } })).toThrow();
    });

    test("should validate ObjectId fields in updates", async () => {
      const schema = M.schema({
        userId: M.objectId(),
        relatedId: M.objectId().optional(),
      });

      const Model = client.model("objectid_update_test", schema);

      await Model.createOne({ userId: new ObjectId() });

      // Should fail: can't set ObjectId field to string
      expect(() => Model.updateOne({}, { $set: { userId: "not-an-objectid" as any } })).toThrow();

      // Should pass: setting ObjectId field to valid ObjectId
      const validId = new ObjectId();
      await Model.updateOne({}, { $set: { userId: validId } });
    });

    test("should validate Date fields in updates", async () => {
      const schema = M.schema({
        eventDate: M.date(),
      });

      const Model = client.model("date_update_test", schema);

      await Model.createOne({ eventDate: new Date() });

      // Should fail: can't set date field to boolean
      expect(() => Model.updateOne({}, { $set: { eventDate: true as any } })).toThrow();

      // Should pass: setting date field to Date object
      await Model.updateOne({}, { $set: { eventDate: new Date() } });

      // Should pass: date strings are valid and will be converted to Date
      await Model.updateOne({}, { $set: { eventDate: "2024-01-01" as any } });
    });

    test("should reject updates that would violate unique constraints", async () => {
      const schema = M.schema({
        email: M.string().uniqueIndex(),
      });

      const Model = client.model("unique_constraint_update_test", schema);

      await Model.createOne({ email: "existing@example.com" });
      await Model.createOne({ email: "other@example.com" });

      // Should fail: updating to existing unique value
      // Note: This requires database-level validation, not just schema validation
      // But parseForUpdate should at least check field exists and has correct type
      expect(() =>
        Model.updateOne({ email: "other@example.com" }, { $set: { email: 123 as any } }),
      ).toThrow();
    });
  });

  describe("Validation with defaultFn and default values", () => {
    test("should not allow updating fields with default values to incompatible types", async () => {
      const schema = M.schema({
        counter: M.number().default(0),
        name: M.string().default("unnamed"),
      });

      const Model = client.model("default_value_update_test", schema);

      // Should fail: wrong type for default field
      expect(() => Model.updateOne({}, { $set: { counter: "not a number" as any } })).toThrow();
      expect(() => Model.updateOne({}, { $set: { name: 123 as any } })).toThrow();
    });
  });

  describe("Regex and Pattern Validation", () => {
    test("should validate string patterns on update", async () => {
      const schema = M.schema({
        email: M.string().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
      });

      const Model = client.model("pattern_update_test", schema);

      // Should fail: doesn't match email pattern
      expect(() => Model.updateOne({}, { $set: { email: "not-an-email" } })).toThrow();
    });

    test("should validate nested field patterns on update", async () => {
      const schema = M.schema({
        contact: M.object({
          phone: M.string().match(/^\+?[1-9]\d{1,14}$/),
        }),
      });

      const Model = client.model("nested_pattern_update_test", schema);

      // Should fail: doesn't match phone pattern
      expect(() => Model.updateOne({}, { $set: { "contact.phone": "invalid" } })).toThrow();
    });
  });
});
