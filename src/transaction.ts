import type { ClientSession, ClientSessionOptions, Document, TransactionOptions } from "mongodb";
import type { MongsterClient } from "./client";
import type { MongsterModel } from "./collection";
import type { MongsterSchema } from "./schema/schema";

export interface MongsterTransactionContext {
  session: ClientSession;
}

export interface MongsterTransactionModel<
  CN extends string,
  SC extends MongsterSchema<any>,
  T extends Document,
  OT extends Document,
> extends MongsterModel<CN, SC, T, OT> {
  /** The active session for this transaction-scoped model */
  readonly session: ClientSession;
}

/**
 * Creates a transaction-scoped version of a model that automatically uses the session
 */
class TransactionModel<
  CN extends string,
  SC extends MongsterSchema<any>,
  T extends Document,
  OT extends Document,
> {
  private baseModel: MongsterModel<CN, SC, T, OT>;
  readonly session: ClientSession;

  constructor(model: MongsterModel<CN, SC, T, OT>, session: ClientSession) {
    this.baseModel = model;
    this.session = session;
  }

  // Proxy all methods to base model with session injection
  private injectSession<O extends Record<string, any>>(
    options?: O,
  ): O & { session: ClientSession } {
    return { ...options, session: this.session } as O & { session: ClientSession };
  }

  async insertOne(input: any, options?: any): Promise<any> {
    return this.baseModel.insertOne(input, this.injectSession(options));
  }

  async insertMany(inputArr: any[], options?: any): Promise<any> {
    return this.baseModel.insertMany(inputArr, this.injectSession(options));
  }

  async createOne(input: any, options?: any): Promise<any> {
    return this.baseModel.createOne(input, this.injectSession(options));
  }

  async createMany(inputArr: any[], options?: any): Promise<any> {
    return this.baseModel.createMany(inputArr, this.injectSession(options));
  }

  async updateOne(filter: any, updateData: any, options?: any): Promise<any> {
    return this.baseModel.updateOne(filter, updateData, this.injectSession(options));
  }

  async updateMany(filter: any, updateData: any, options?: any): Promise<any> {
    return this.baseModel.updateMany(filter, updateData, this.injectSession(options));
  }

  async findOneAndUpdate(filter: any, updateData: any, options?: any): Promise<any> {
    return this.baseModel.findOneAndUpdate(filter, updateData, this.injectSession(options));
  }

  async replaceOne(filter: any, replacement: any, options?: any): Promise<any> {
    return this.baseModel.replaceOne(filter, replacement, this.injectSession(options));
  }

  async findOneAndReplace(filter: any, replacement: any, options?: any): Promise<any> {
    return this.baseModel.findOneAndReplace(filter, replacement, this.injectSession(options));
  }

  async deleteOne(filter: any, options?: any): Promise<any> {
    return this.baseModel.deleteOne(filter, this.injectSession(options));
  }

  async deleteMany(filter: any, options?: any): Promise<any> {
    return this.baseModel.deleteMany(filter, this.injectSession(options));
  }

  async findOneAndDelete(filter: any, options?: any): Promise<any> {
    return this.baseModel.findOneAndDelete(filter, this.injectSession(options));
  }

  find(filter?: any, options?: any): any {
    return this.baseModel.find(filter, this.injectSession(options));
  }

  async findOne(filter: any, options?: any): Promise<any> {
    return this.baseModel.findOne(filter, this.injectSession(options));
  }

  async count(filter?: any, options?: any): Promise<number> {
    return this.baseModel.count(filter, this.injectSession(options));
  }

  async distinct(key: any, filter?: any, options?: any): Promise<any> {
    return this.baseModel.distinct(key, filter, this.injectSession(options));
  }

  async aggregateRaw<ReturnType = Document[]>(
    pipeline?: Document[],
    options?: any,
  ): Promise<ReturnType> {
    return this.baseModel.aggregateRaw<ReturnType>(pipeline, this.injectSession(options));
  }

  // Expose useful methods from base model
  getCollection(): any {
    return this.baseModel.getCollection();
  }

  getCollectionName(): string {
    return this.baseModel.getCollectionName();
  }
}

export type TransactionCallback<T> = (ctx: MongsterTransactionContext) => Promise<T>;

export interface MongsterTransaction {
  /**
   * Start a transaction with automatic commit/abort handling
   * @param callback Transaction callback function
   * @param options Transaction options
   * @returns Result from the callback
   */
  <T>(callback: TransactionCallback<T>, options?: TransactionOptions): Promise<T>;

  /**
   * Get a model scoped to this transaction
   * @param model The model to wrap with transaction context
   * @returns Transaction-scoped model that automatically uses the session
   */
  with<M extends MongsterModel<any, any, any, any>>(
    model: M,
  ): MongsterTransactionModel<any, any, any, any>;
}

/**
 * Creates a transaction manager for the client
 */
export function createTransactionManager(client: MongsterClient): {
  transaction: MongsterTransaction;
  startSession: (options?: ClientSessionOptions) => Promise<ClientSession>;
} {
  let currentSession: ClientSession | null = null;

  const transaction: any = async <T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T> => {
    const mongoClient = client.getClient();
    const session = mongoClient.startSession();
    currentSession = session;

    try {
      let result: T | undefined;

      await session.withTransaction(async () => {
        const ctx: MongsterTransactionContext = { session };
        result = await callback(ctx);
      }, options);

      if (result === undefined) {
        throw new Error("Transaction callback did not return a value");
      }

      return result;
    } finally {
      await session.endSession();
      currentSession = null;
    }
  };

  transaction.with = <M extends MongsterModel<any, any, any, any>>(
    model: M,
  ): MongsterTransactionModel<any, any, any, any> => {
    if (!currentSession) {
      throw new Error(
        "Cannot create transaction-scoped model outside of a transaction. Call this within a transaction callback.",
      );
    }

    return new TransactionModel(model, currentSession) as any;
  };

  const startSession = async (options?: ClientSessionOptions): Promise<ClientSession> => {
    const mongoClient = client.getClient();
    return mongoClient.startSession(options);
  };

  return { transaction, startSession };
}
