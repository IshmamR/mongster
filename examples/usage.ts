import { defineSchema, M, MongsterClient, model, mongster } from "../src/index";
import type { PropertyType } from "../src/types/types.filter";
import type { AllFilterKeys, AllProjKeys } from "../src/types/types.query";
import type { InferSchemaInputType, InferSchemaType } from "../src/types/types.schema";

// 1. M.string()
const s = M.string();

// Embedded doc MUST use object(), not schema()
const addressSchema = M.object({
  zip: M.number(),
});
const userSchema = defineSchema({
  // _id: M.number(),
  name: M.string(),
  age: M.number().index(1),
  nested: M.object({
    l1: M.number(),
    l2: M.string(),
    l3: M.array(
      M.object({
        m1: M.string(),
      }),
    ),
  }).optional(),
  socials: M.object({ link: M.string(), site: M.string() }).array().optional(),
  anotherId: M.objectId().optional(),
}).withTimestamps();

// 3. collection(name, schema)
const User = model("users", userSchema);

type TUser = InferSchemaType<typeof userSchema>;
type TUserInput = InferSchemaInputType<typeof userSchema>;

type TestFilterKeys = AllFilterKeys<TUser>;
type TestProjKeys = AllProjKeys<TUser>;

const result = await User.create({
  age: 1,
  name: "promethewz",
});

const list = await User.find({ age: { $eq: 1 } })
  // .skip(10)
  // .limit(10)
  // .sort({ socials: 1 })
  .include(["socials.site", "nested.l3.m1"]);
// .project({ "socials.$.link": 0 });
// .exclude(["_id"]);
// .exclude(["age"]);
// .project({ "nested.l1": 1 });

User.updateOne({}, { $set: { "socials.link": "" } });

type Test = PropertyType<TUser, "nested.l3.m1">;
//   ^?

// 4. mongster.collection(name, schema)
mongster.model("accounts", userSchema);

// 5. separate instance if desired
const custom = new MongsterClient();
custom.model("customs", userSchema);

console.log("OK", s.constructor.name, userSchema.collectIndexes().length);
