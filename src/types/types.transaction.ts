import type {
  Abortable,
  AggregateOptions,
  BulkWriteOptions,
  ClientSession,
  CountDocumentsOptions,
  DeleteOptions,
  DistinctOptions,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  FindOneOptions,
  FindOptions,
  InsertOneOptions,
  ReplaceOptions,
  TransactionOptions,
  UpdateOptions,
} from "mongodb";
import type { MongsterModel } from "../collection";
import type { MongsterSchema } from "../schema/schema";
import type { TransactionModel } from "../transaction";

export interface MongsterTransactionContext {
  session: ClientSession;
  /**
   * Build a model scoped to this transaction
   * @param model The model to wrap with transaction context
   * @returns Transaction-scoped model that automatically uses the session
   */
  use<
    CN extends string,
    SC extends MongsterSchema<any, any>,
    T extends Document,
    OT extends Document,
  >(model: MongsterModel<CN, SC, T, OT>): TransactionModel<CN, SC, T, OT>;
}

export type TransactionCallback<T> = (ctx: MongsterTransactionContext) => Promise<T>;

export type MongsterTransaction = <T = void>(
  callback: TransactionCallback<T>,
  options?: TransactionOptions,
) => Promise<T>;

export type InsertOneTransactionOptions = Omit<InsertOneOptions, "session">;
export type BulkWriteTransactionOptions = Omit<BulkWriteOptions, "session">;
export type UpdateTransactionOptions = Omit<UpdateOptions, "session">;
export type FindOneAndUpdateTransactionOptions = Omit<FindOneAndUpdateOptions, "session"> & {
  includeResultMetadata: true;
};
export type ReplaceTransactionOptions = Omit<ReplaceOptions, "session">;
export type FindOneAndReplaceTransactionOptions = Omit<FindOneAndReplaceOptions, "session"> & {
  includeResultMetadata: true;
};
export type DeleteTransactionOptions = Omit<DeleteOptions, "session">;
export type FindOneAndDeleteTransactionOptions = Omit<FindOneAndDeleteOptions, "session"> & {
  includeResultMetadata: true;
};
export type FindTransactionOptions = Omit<FindOptions, "session"> & Abortable;
export type FindOneTransactionOptions = Omit<FindOneOptions, "session" | "timeoutMode"> & Abortable;
export type CountTransactionOptions = Omit<CountDocumentsOptions, "session"> & Abortable;
export type DistinctTransactionOptions = Omit<DistinctOptions, "session">;
export type AggregateTransactionOptions = Omit<AggregateOptions, "session"> & Abortable;
