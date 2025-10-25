import { afterAll, beforeAll, describe, test } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongsterSchemaBuilder } from "../src/schema";
import { MongsterClient } from "../src/client";

const M = new MongsterSchemaBuilder();

let mongod: MongoMemoryServer | null = null;
let client: MongsterClient;

describe("Runtime update data validation", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongsterClient();
    await client.connect(mongod.getUri(), {});
  });

  afterAll(async () => {
    await client.disconnect();
    await mongod?.stop();
  });

  describe("Basic schemas", () => {
    test("Should handle basic schema", () => {
      const userSchema = M.schema({
        name: M.string().min(2).max(10),
        age: M.number().min(18).max(40),
        socials: M.array(M.string()),
        nested: M.object({
          n1: M.string(),
        }),
      }).withTimestamps();

      // userSchema.parseForUpdate();

      const UserModel = client.model("users", userSchema);

      UserModel.updateOne({}, { $bit: { age: { xor: 3 } } });
    });
  });
});
