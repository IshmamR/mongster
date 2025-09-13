/** biome-ignore-all lint/suspicious/noExplicitAny: needed */

// export type OmitFields<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
// export type OmitFieldIfPresent<Rec, K extends string> = K extends keyof Rec ? Omit<Rec, K> : Rec;

// /**
//  * turns  {a:1} | {b:0}  into  {a:1} & {b:0}
//  */
// export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
//   k: infer I,
// ) => void
//   ? I
//   : never;

// export type Prettify<Obj> = { [K in keyof Obj]: Obj[K] } & {};

// export type Optional<Obj, K extends keyof Obj> = Omit<Obj, K> & Partial<Pick<Obj, K>>;
