import type { FindCursor } from "mongodb";
import type { PositiveNumber } from "../../types/types.common";

export function skipFunc<N extends number, T>(cursor: FindCursor<T>, n: PositiveNumber<N>) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("Skip must be a positive integer");
  }
  return cursor.skip(n);
}
