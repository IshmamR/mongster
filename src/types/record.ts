/** biome-ignore-all lint/suspicious/noExplicitAny: needed */

// export type OmitFields<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
// export type OmitFieldIfPresent<Rec, K extends string> = K extends keyof Rec ? Omit<Rec, K> : Rec;

// export type Prettify<Obj> = { [K in keyof Obj]: Obj[K] } & {};

// export type Optional<Obj, K extends keyof Obj> = Omit<Obj, K> & Partial<Pick<Obj, K>>;
