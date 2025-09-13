import type { Builtins } from "./types.schema";

type IsBuiltins<T> = T extends Builtins ? true : false;
type IsArray<T> = T extends ReadonlyArray<any> ? true : false;

// 7even: 7 recursive sins
type Inc = { 0: 1; 1: 2; 2: 3; 3: 4; 4: 5; 5: 6; 6: 7; 7: 7 };
type _Paths<O, P extends string = "", D extends 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 = 0> = D extends 7
  ? P
  : O extends Builtins
    ? P // leaf → return path
    : IsArray<O> extends true // ~ array branch
      ? O extends ReadonlyArray<infer E> // grab element type
        ? IsBuiltins<E> extends true // element is primitive
          ? P //   stop here
          : _Paths<E, P, Inc[D]> //   recurse into element
        : never
      : O extends object // ~ object branch
        ? {
            [K in keyof O &
              (string | number)]: `${P}${P extends "" ? "" : "."}${K}` extends infer NK // build union of sub-paths
              ? NK extends string
                ? _Paths<O[K], NK, Inc[D]> // recurse with longer path
                : never
              : never;
          }[keyof O & (string | number)]
        : P;

/**
 * Generate typed keys for a given object (yes, even nested ones with arrays)
 */
export type DotSeparatedKeys<O> = _Paths<O>;
