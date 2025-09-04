import { type Db, MongoClient, type MongoClientOptions } from "mongodb";

export interface ConnectOptions extends MongoClientOptions {
  dbName?: string;
}

let defaultClient: MongoClient | null = null;
let defaultDb: Db | null = null;

export async function createConnection(url: string, options?: ConnectOptions) {
  if (defaultClient) return defaultClient;

  const { dbName, ...opts } = options ?? {};

  try {
    defaultClient = new MongoClient(url, opts);
    await defaultClient.connect();
    defaultDb = defaultClient.db(dbName);

    await defaultDb.command({ ping: 1 });
  } catch (err) {
    // console.log(err);
    // biome-ignore lint/complexity/noUselessCatch: some logging stuff
    throw err;
  }

  return defaultClient;
}

export async function closeConnection() {
  if (defaultClient) await defaultClient.close();
}

/**
 *
 * @returns the default database
 */
export function getDb() {
  if (!defaultDb) throw new Error("Database not connected. Call createConnection() first.");
  return defaultDb;
}
