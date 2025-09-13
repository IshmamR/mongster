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
export type NegativeNumber<N extends number> = `${N}` extends `-${string}` | "0"
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
