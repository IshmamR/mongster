// /**
//  * Core types for mongster – a TypeScript-first, chainable MongoDB ODM.
//  * Design goals:
//  * - No decorators, no duplicate schema definitions.
//  * - Strong, compile-time safety via plain TS interfaces.
//  */

// import type { ObjectId } from "bson";

// // A generic document type with an optional id field.
// export type Doc<T> = T & { _id?: ObjectId };

// export type Primitive = string | number | boolean | Date | null | undefined;

// export type Condition<V> =
//   | { $eq?: V }
//   | { $ne?: V }
//   | { $gt?: V }
//   | { $gte?: V }
//   | { $lt?: V }
//   | { $lte?: V }
//   | { $in?: V extends Primitive ? V[] : never }
//   | { $nin?: V extends Primitive ? V[] : never };

// export type Filter<T> = {
//   [K in keyof T]?: T[K] | Condition<T[K]>;
// } & {
//   $and?: Filter<T>[];
//   $or?: Filter<T>[];
// };

// // Result helpers
// export interface InsertResult<T> {
//   insertedId: ObjectId;
//   doc: Doc<T>;
// }
// export interface UpdateResult {
//   matchedCount: number;
//   modifiedCount: number;
// }
// export interface DeleteResult {
//   deletedCount: number;
// }
