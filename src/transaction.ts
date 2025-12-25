import type {
  ClientSession,
  ClientSessionOptions,
  Collection,
  DeleteResult,
  Document,
  Filter,
  Flatten,
  InsertManyResult,
  InsertOneResult,
  OptionalUnlessRequiredId,
  TransactionOptions,
  UpdateResult,
  WithId,
  WithoutId,
} from "mongodb";
import type { MongsterClient } from "./client";
import type { MongsterModel } from "./collection";
import { TransactionError } from "./error";
import type { MongsterSchema } from "./schema/schema";
import type { MongsterFilter, MongsterUpdateFilter } from "./types/types.filter";
import type { AllFilterKeys } from "./types/types.query";
import type {
  AggregateTransactionOptions,
  BulkWriteTransactionOptions,
  CountTransactionOptions,
  DeleteTransactionOptions,
  DistinctTransactionOptions,
  FindOneAndDeleteTransactionOptions,
  FindOneAndReplaceTransactionOptions,
  FindOneAndUpdateTransactionOptions,
  FindOneTransactionOptions,
  FindTransactionOptions,
  InsertOneTransactionOptions,
  MongsterTransaction,
  ReplaceTransactionOptions,
  TransactionCallback,
  UpdateTransactionOptions,
} from "./types/types.transaction";

/**
 * Creates a transaction-scoped version of a model that automatically uses the session
 */
export class TransactionModel<
  CN extends string,
  SC extends MongsterSchema<any>,
  T extends Document,
  OT extends Document,
> {
  #baseModel: MongsterModel<CN, SC, T, OT>;
  readonly session: ClientSession;

  constructor(model: MongsterModel<CN, SC, T, OT>, session: ClientSession) {
    this.#baseModel = model;
    this.session = session;
  }

  #injectSession<O extends Record<string, any>>(options?: O): O & { session: ClientSession } {
    let opt = options;
    if (typeof options !== "object" || Array.isArray(options)) opt = undefined;
    return { ...(opt ?? {}), session: this.session } as O & { session: ClientSession };
  }

  async insertOne(
    input: OptionalUnlessRequiredId<T>,
    options?: InsertOneTransactionOptions,
  ): Promise<InsertOneResult<OT>> {
    return this.#baseModel.insertOne(input, this.#injectSession(options));
  }

  async insertMany(
    inputArr: OptionalUnlessRequiredId<OT>[],
    options?: BulkWriteTransactionOptions,
  ): Promise<InsertManyResult<OT>> {
    return this.#baseModel.insertMany(inputArr, this.#injectSession(options));
  }

  async createOne(
    input: OptionalUnlessRequiredId<T>,
    options?: InsertOneTransactionOptions,
  ): Promise<OT | null> {
    return this.#baseModel.createOne(input, this.#injectSession(options));
  }

  async createMany(
    inputArr: OptionalUnlessRequiredId<T>[],
    options?: BulkWriteTransactionOptions,
  ): Promise<OT[]> {
    return this.#baseModel.createMany(inputArr, this.#injectSession(options));
  }

  async updateOne(
    filter: MongsterFilter<OT>,
    updateData: MongsterUpdateFilter<OT>,
    options?: UpdateTransactionOptions,
  ): Promise<UpdateResult<OT>> {
    return this.#baseModel.updateOne(filter, updateData, this.#injectSession(options));
  }

  async updateMany(
    filter: MongsterFilter<OT>,
    updateData: MongsterUpdateFilter<OT>,
    options?: UpdateTransactionOptions,
  ): Promise<UpdateResult<OT>> {
    return this.#baseModel.updateMany(filter, updateData, this.#injectSession(options));
  }

  async findOneAndUpdate(
    filter: MongsterFilter<OT>,
    updateData: MongsterUpdateFilter<OT>,
    options?: FindOneAndUpdateTransactionOptions,
  ): Promise<WithId<OT> | null> {
    return this.#baseModel.findOneAndUpdate(filter, updateData, this.#injectSession(options));
  }

  async replaceOne(
    filter: MongsterFilter<OT>,
    replacement: WithoutId<OT>,
    options?: ReplaceTransactionOptions,
  ): Promise<UpdateResult<OT>> {
    return this.#baseModel.replaceOne(filter, replacement, this.#injectSession(options));
  }

  async findOneAndReplace(
    filter: MongsterFilter<OT>,
    replacement: WithoutId<OT>,
    options?: FindOneAndReplaceTransactionOptions,
  ): Promise<WithId<OT> | null> {
    return this.#baseModel.findOneAndReplace(filter, replacement, this.#injectSession(options));
  }

  async deleteOne(
    filter: MongsterFilter<OT>,
    options?: DeleteTransactionOptions,
  ): Promise<DeleteResult> {
    return this.#baseModel.deleteOne(filter, this.#injectSession(options));
  }

  async deleteMany(
    filter: MongsterFilter<OT>,
    options?: DeleteTransactionOptions,
  ): Promise<DeleteResult> {
    return this.#baseModel.deleteMany(filter, this.#injectSession(options));
  }

  async findOneAndDelete(
    filter: MongsterFilter<OT>,
    options?: FindOneAndDeleteTransactionOptions,
  ): Promise<WithId<OT> | null> {
    return this.#baseModel.findOneAndDelete(filter, this.#injectSession(options));
  }

  find(filter?: MongsterFilter<OT>, options?: FindTransactionOptions) {
    return this.#baseModel.find(filter, this.#injectSession(options));
  }

  async findOne(
    filter: MongsterFilter<OT>,
    options?: FindOneTransactionOptions,
  ): Promise<OT | null> {
    return this.#baseModel.findOne(filter, this.#injectSession(options));
  }

  async count(filter?: Filter<OT>, options?: CountTransactionOptions): Promise<number> {
    return this.#baseModel.count(filter, this.#injectSession(options));
  }

  async distinct(
    key: AllFilterKeys<OT>,
    filter?: MongsterFilter<OT>,
    options?: DistinctTransactionOptions,
  ): Promise<Flatten<WithId<OT>[string]>[]> {
    return this.#baseModel.distinct(key, filter, this.#injectSession(options));
  }

  async aggregateRaw<ReturnType = Document[]>(
    pipeline?: Document[],
    options?: AggregateTransactionOptions,
  ): Promise<ReturnType> {
    return this.#baseModel.aggregateRaw<ReturnType>(pipeline, this.#injectSession(options));
  }

  getCollection(): Collection<OT> {
    return this.#baseModel.getCollection();
  }

  getCollectionName(): string {
    return this.#baseModel.getCollectionName();
  }
}

/**
 * Build a transaction manager for the client
 */
export function createTransactionManager(client: MongsterClient): {
  transaction: MongsterTransaction;
  startSession: (options?: ClientSessionOptions) => Promise<ClientSession>;
} {
  const transaction: MongsterTransaction = async <T = void>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T> => {
    const mongoClient = client.getClient();
    const session = mongoClient.startSession();

    try {
      let result!: T;

      await session.withTransaction(async () => {
        result = await callback({
          session,
          use: (model) => new TransactionModel(model, session),
        });
      }, options);

      return result;
    } catch (err) {
      if (err instanceof Error) {
        throw new TransactionError(err.message, { cause: err });
      }
      throw new TransactionError("Transaction failed", { cause: err });
    } finally {
      await session.endSession();
    }
  };

  const startSession = async (options?: ClientSessionOptions): Promise<ClientSession> => {
    const mongoClient = client.getClient();
    return mongoClient.startSession(options);
  };

  return { transaction, startSession };
}
