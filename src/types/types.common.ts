/**
 * Just because
 */
export type TheNumberZero = 0;

/**
 * Brand for strictly positive integers.
 * Any negative or zero literal will produce `never`, which is intentional.
 */
export type PositiveNumber<N extends number> = `${N}` extends `-${string}`
  ? [`❌  ${N} is not positive`]
  : N;

/**
 * Brand for strictly negative integers.
 * Any negative or zero literal will produce `never`, which is intentional.
 */
export type NegativeNumber<N extends number> = `${N}` extends `-${string}`
  ? N
  : [`❌  ${N} is not negative`];

/**
 * 0 | 1
 */
export type BooleanNumber = 0 | 1;

/**
 * As the name suggests
 */
export type NonEmptyString<N extends string> = N extends "" ? never : N;

/**
 * As the name suggests
 */
export type Prettify<Obj> = { [K in keyof Obj]: Obj[K] } & {};

/**
 * Omit a filed from a record
 */
export type OmitFields<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/**
 * Omits a field only if it is present in the record that was passed
 */
export type OmitFieldIfPresent<Rec, K extends string> = K extends keyof Rec ? Omit<Rec, K> : Rec;

/**
 * turn `{a:1} | {b:0}`  into  `{a:1} & {b:0}`
 */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export type OptionalKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T];
export type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>;

export type Merge<T> = { [K in keyof T]: T[K] };
