import { MongoClient } from "mongodb";

// biome-ignore lint/style/noNonNullAssertion: emni
const client = await MongoClient.connect(process.env.MONGODB_URI!);
console.log(client.options.dbName);
await client.close();
