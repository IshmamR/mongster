import { type Db, MongoClient, type MongoClientOptions } from "mongodb";
import { MongsterCollection } from "./collection";
import type { MongsterSchema } from "./schema/base";

interface MongsterClientOptions extends MongoClientOptions {
  retryConnection?: number;
  retryDelayMs?: number;
}

export class MongsterClient {
  #uri: string | undefined;
  #options: MongsterClientOptions = {};
  #client: MongoClient | undefined;
  #dbName: string | undefined;
  #connected = false;

  private collectionSchemas = new Map<string, MongsterSchema<any>>();

  constructor(uri?: string, options?: MongsterClientOptions) {
    this.#uri = uri;
    this.#options = options ?? {};
  }

  collection<CN extends string, SC extends MongsterSchema<any, any>>(
    collectionName: CN,
    schema: SC,
  ) {
    this.collectionSchemas.set(collectionName, schema);
    return new MongsterCollection(this, collectionName, schema);
  }

  /**
   * Alias to `.collection()`
   */
  model<CN extends string, SC extends MongsterSchema<any, any>>(collectionName: CN, schema: SC) {
    return this.collection(collectionName, schema);
  }

  async connect(uri?: string, options?: MongsterClientOptions): Promise<void> {
    this.#uri = typeof uri !== "undefined" ? uri : this.#uri;
    if (!this.#uri) throw new Error("No database URI was provided");

    this.#options = { ...this.#options, ...options };
    const { retryConnection = 1, retryDelayMs = 200, ...mongoClientOptions } = this.#options;

    let retryAttempt = 0;
    let lastErr: unknown;

    const maxAttempts = Math.max(1, retryConnection);
    const baseDelay = Math.max(0, retryDelayMs);

    do {
      try {
        const client = await MongoClient.connect(this.#uri, mongoClientOptions);
        await client.db("admin").command({ ping: 1 });
        this.#client = client;
        this.#dbName = client.options.dbName;
        this.#connected = true;
        return;
      } catch (err) {
        this.#connected = false;
        this.#client = undefined;
        lastErr = err;
        retryAttempt++;

        if (retryAttempt >= maxAttempts) break;

        const jitter = Math.floor(Math.random() * 100);
        await new Promise((r) => setTimeout(r, baseDelay + jitter));
      }
    } while (!this.#connected && retryAttempt < maxAttempts);

    if (lastErr instanceof Error) throw lastErr;
    throw new Error("Failed to connect to database");
  }

  async disconnect(): Promise<void> {
    if (!this.#client) return;
    await this.#client.close();
    this.#connected = false;
    this.#client = undefined;
  }

  async ping(): Promise<boolean> {
    if (!this.#client) return false;
    try {
      await this.#client.db("admin").command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this.#connected;
  }

  getClient(): MongoClient {
    if (!this.#client) throw new Error("Not connected");
    return this.#client;
  }

  getDb(name?: string): Db {
    if (!this.#client) throw new Error("DB not connected");
    return this.#client.db(name ?? this.#dbName ?? "test");
  }
}
