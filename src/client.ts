import { type Db, MongoClient, type MongoClientOptions } from "mongodb";
import { MongsterModel } from "./collection";
import type { MongsterSchema } from "./schema/schema";
import { createTransactionManager, type MongsterTransaction } from "./transaction";

interface MongsterClientOptions extends MongoClientOptions {
  retryConnection?: number;
  retryDelayMs?: number;
  autoIndex?: { syncOnConnect?: boolean } | boolean;
}

export class MongsterClient {
  #uri: string | undefined;
  #options: MongsterClientOptions = { autoIndex: true };
  #client: MongoClient | undefined;
  #dbName: string | undefined;
  #connected = false;

  #schemas = new Map<string, MongsterSchema<any>>();
  #models = new Map<string, MongsterModel<any, any, any, any>>();

  /** Transaction API - automatically handles session management */
  public readonly transaction: MongsterTransaction;

  constructor(uri?: string, options?: MongsterClientOptions) {
    this.#uri = uri;
    this.#options = { ...this.#options, ...options };

    // Initialize transaction API
    const { transaction } = createTransactionManager(this);
    this.transaction = transaction;
  }

  model<CN extends string, SC extends MongsterSchema<any, any>>(collectionName: CN, schema: SC) {
    this.#schemas.set(collectionName, schema);
    const model = new MongsterModel(this, collectionName, schema);
    this.#models.set(collectionName, model);
    return model;
  }

  async connect(uri?: string, options?: MongsterClientOptions): Promise<void> {
    this.#uri = typeof uri !== "undefined" ? uri : this.#uri;
    if (!this.#uri) throw new Error("No database URI was provided");

    this.#options = { ...this.#options, ...options };
    const {
      retryConnection = 1,
      retryDelayMs = 200,
      autoIndex,
      ...mongoClientOptions
    } = this.#options;

    let retryAttempt = 0;
    let lastErr: unknown;

    const maxAttempts = Math.max(1, retryConnection);
    const baseDelay = Math.max(0, retryDelayMs);

    do {
      try {
        const client = await MongoClient.connect(this.#uri, mongoClientOptions);
        this.#client = client;
        this.#dbName = client.options.dbName;
        this.#connected = true;

        if (typeof autoIndex === "object" && autoIndex.syncOnConnect) {
          await this.syncIndexes();
        }

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

  async syncIndexes() {
    const promises = this.#models.values().map((model) => model.syncIndexes().catch(() => {}));
    await Promise.all(promises);
  }

  async disconnect(): Promise<void> {
    if (!this.#client) return;
    await this.#client.close();
    this.#connected = false;
    this.#client = undefined;
  }

  async ping(dbToPing = "admin"): Promise<boolean> {
    if (!this.#client) return false;
    try {
      await this.#client.db(dbToPing).command({ ping: 1 });
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

  getOptions() {
    return this.#options;
  }
}
