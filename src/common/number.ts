export type TheNumberZero = 0;
export type PositiveNumber<N extends number> = `${N}` extends `-${string}` | "0" ? never : N;
export type NegativeNumber<N extends number> = `${N}` extends `-${string}` ? N : never;
export type BooleanNumber = 0 | 1;
