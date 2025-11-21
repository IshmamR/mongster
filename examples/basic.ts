/** biome-ignore-all lint/suspicious/noConsole: hmmm */
import { M, mongster } from "../src";

const userSchema = M.schema({
  name: M.string(),
  age: M.number(),
  dob: M.date().optional(),
  gender: M.boolean(),
  role: M.string().enum(["admin", "janitor"] as const),
  socials: M.array(
    M.object({
      host: M.string(),
      link: M.string(),
    }),
  ),
});

type TUser = M.infer<typeof userSchema>;
//    ^?
type TUserCreate = M.inferInput<typeof userSchema>;
//    ^?

const UserModel = mongster.model("users", userSchema);

await mongster.connect(process.env.DB_URL);

const result = await UserModel.createOne({
  name: "promethewz",
  age: 18,
  gender: true,
  socials: [{ host: "github", link: "https://github.com/IshmamR" }],
  role: "admin",
  dob: new Date(),
});

console.log(result);
