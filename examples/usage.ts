import { collection, M, Mongster, mongster } from "../src/index";
import type { InferSchemaInputType, InferSchemaType } from "../src/types/types.schema";

// 1. M.string()
const s = M.string();

// Embedded doc MUST use object(), not schema()
const addressSchema = M.object({
  zip: M.number(),
});
const userSchema = M.schema({
  name: M.string(),
  age: M.number().index(1),
});

// 3. collection(name, schema)
const User = collection("users", userSchema);

type TUser = InferSchemaType<typeof userSchema>;
type TUserInput = InferSchemaInputType<typeof userSchema>;

const result = await User.insertOne({
  age: 1,
  name: "promethewz",
});

// 4. mongster.collection(name, schema)
mongster.collection("accounts", userSchema);

// 5. separate instance if desired
const custom = new Mongster();
custom.collection("customs", userSchema);

console.log("OK", s.constructor.name, userSchema.collectIndexes().length);
