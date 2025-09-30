import { collection, defineSchema, M, Mongster, mongster } from "../src/index";
import type { AllKeys } from "../src/queries/find/types";
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
  }).optional(),
  socials: M.object({ link: M.string(), site: M.string() }).array().optional(),
  anotherId: M.objectId().optional(),
}).withTimestamps();

// 3. collection(name, schema)
const User = collection("users", userSchema);

type TUser = InferSchemaType<typeof userSchema>;
type TUserInput = InferSchemaInputType<typeof userSchema>;

const result = await User.create({
  // _id: 234,
  age: 1,
  name: "promethewz",
});

type TT = AllKeys<TUser>;

const list = await User.find({ age: { $gt: 18 } })
  // .skip(10)
  // .limit(10)
  // .sort({ socials: 1 })
  // .include(["socials.link"])
  // .exclude(["age"]);
  .project({ "nested.l1": 1 });

// 4. mongster.collection(name, schema)
mongster.collection("accounts", userSchema);

// 5. separate instance if desired
const custom = new Mongster();
custom.collection("customs", userSchema);

console.log("OK", s.constructor.name, userSchema.collectIndexes().length);
