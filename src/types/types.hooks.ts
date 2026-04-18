import type {
  DeleteResult,
  Document,
  InsertManyResult,
  InsertOneResult,
  UpdateResult,
  WithId,
  WithoutId,
} from "mongodb";
import type { Prettify } from "./types.common";
import type { MongsterFilter, MongsterUpdateFilter } from "./types.filter";

export const saveOperations = ["insertOne", "insertMany", "createOne", "createMany"] as const;
export const modifyOperations = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
  "upsertOne",
] as const;
export const removeOperations = ["deleteOne", "deleteMany", "findOneAndDelete"] as const;
export const findOperations = ["find", "findOne", "findById"] as const;

/** all hook-able operations */
export type HookOperation =
  | (typeof saveOperations)[number]
  | (typeof modifyOperations)[number]
  | (typeof removeOperations)[number]
  | (typeof findOperations)[number];

export type HookGroupAlias = "save" | "modify" | "remove";

/** all valid hook names: individual operations + group aliases */
export type HookName = Prettify<HookOperation | HookGroupAlias>;

/**
 * per operation context for pre-hooks
 * pre-hooks can receive and return a modified version
 *
 * @typeParam I - Input document type
 * @typeParam O - Output document type
 */
export interface PreHookContextMap<I, O extends Document> {
  insertOne: { doc: I };
  createOne: { doc: I };
  insertMany: { docs: I[] };
  createMany: { docs: I[] };
  updateOne: { filter: MongsterFilter<O>; update: MongsterUpdateFilter<O> };
  updateMany: { filter: MongsterFilter<O>; update: MongsterUpdateFilter<O> };
  findOneAndUpdate: { filter: MongsterFilter<O>; update: MongsterUpdateFilter<O> };
  replaceOne: { filter: MongsterFilter<O>; replacement: WithoutId<O> };
  findOneAndReplace: { filter: MongsterFilter<O>; replacement: WithoutId<O> };
  upsertOne: { filter: MongsterFilter<O>; doc: I };
  deleteOne: { filter: MongsterFilter<O> };
  deleteMany: { filter: MongsterFilter<O> };
  findOneAndDelete: { filter: MongsterFilter<O> };
  find: { filter: MongsterFilter<O> };
  findOne: { filter: MongsterFilter<O> };
  findById: { _id: WithId<O>["_id"] };
  // Group aliases; union of possible args
  save: { doc?: I; docs?: I[] };
  modify: {
    filter: MongsterFilter<O>;
    update?: MongsterUpdateFilter<O>;
    replacement?: WithoutId<O>;
    doc?: I;
  };
  remove: { filter: MongsterFilter<O> };
}

/**
 * per operation context for post-hooks
 * post-hook receives the original args and the operation result
 *
 * @typeParam I - Input document type
 * @typeParam O - Output document type
 */
export interface PostHookContextMap<I, O extends Document> {
  insertOne: { doc: I; result: InsertOneResult<O> };
  createOne: { doc: I; result: O | null };
  insertMany: { docs: I[]; result: InsertManyResult<O> };
  createMany: { docs: I[]; result: O[] };
  updateOne: {
    filter: MongsterFilter<O>;
    update: MongsterUpdateFilter<O>;
    result: UpdateResult<O>;
  };
  updateMany: {
    filter: MongsterFilter<O>;
    update: MongsterUpdateFilter<O>;
    result: UpdateResult<O>;
  };
  findOneAndUpdate: {
    filter: MongsterFilter<O>;
    update: MongsterUpdateFilter<O>;
    result: WithId<O> | null;
  };
  replaceOne: {
    filter: MongsterFilter<O>;
    replacement: WithoutId<O>;
    result: UpdateResult<O>;
  };
  findOneAndReplace: {
    filter: MongsterFilter<O>;
    replacement: WithoutId<O>;
    result: WithId<O> | null;
  };
  upsertOne: { filter: MongsterFilter<O>; doc: I; result: UpdateResult<O> };
  deleteOne: { filter: MongsterFilter<O>; result: DeleteResult };
  deleteMany: { filter: MongsterFilter<O>; result: DeleteResult };
  findOneAndDelete: { filter: MongsterFilter<O>; result: WithId<O> | null };
  find: { filter: MongsterFilter<O>; result: O[] };
  findOne: { filter: MongsterFilter<O>; result: O | null };
  findById: { _id: WithId<O>["_id"]; result: O | null };
  // Group aliases
  save: { doc?: I; docs?: I[]; result: unknown };
  modify: {
    filter: MongsterFilter<O>;
    update?: MongsterUpdateFilter<O>;
    replacement?: WithoutId<O>;
    doc?: I;
    result: unknown;
  };
  remove: { filter: MongsterFilter<O>; result: unknown };
}

/**
 * can return modified context or undefined
 * if modified context returned, it replaces original args
 */
export type PreHookFn<Op extends HookName, I = any, O extends Document = Document> = (
  ctx: PreHookContextMap<I, O>[Op],
  // biome-ignore lint/suspicious/noConfusingVoidType: need to use void
) => Promise<void | PreHookContextMap<I, O>[Op]> | PreHookContextMap<I, O>[Op] | void;

/**
 * receives context with result
 * cannot modify result
 */
export type PostHookFn<Op extends HookName, I = any, O extends Document = Document> = (
  ctx: PostHookContextMap<I, O>[Op],
) => Promise<void> | void;
