import type { Decimal128 } from "bson";
import type { Prettify } from "../common/record";

/**
 * Supported field types
 */
export type FieldType =
  | readonly [FieldType]
  | [FieldType]
  | NumberConstructor
  | StringConstructor
  | DateConstructor
  | BooleanConstructor
  | typeof Decimal128;

/**
 * Recursive nested record type for the schema definition
 */
export interface SchemaDefinition {
  [key: string]: FieldDefinition;
}

// Allow nested schema objects as field types too
export type FieldLike =
  | FieldType
  | SchemaDefinition
  | readonly [SchemaDefinition]
  | [SchemaDefinition];

/**
 * Extract TS type from constructor/array form
 */
export type TypeFromField<FT> = FT extends readonly [infer ElemType]
  ? Array<TypeFromField<ElemType>>
  : FT extends [infer ElemType]
    ? Array<TypeFromField<ElemType>>
    : FT extends StringConstructor
      ? string
      : FT extends NumberConstructor
        ? number
        : FT extends BooleanConstructor
          ? boolean
          : FT extends DateConstructor
            ? Date
            : FT extends typeof Decimal128
              ? Decimal128
              : never;

/**
 * Turn the run-time union declaration into a TS union type
 */
type UnionToTs<Opts extends readonly FieldType[]> = Opts extends readonly [infer H, ...infer T]
  ? T extends readonly FieldType[]
    ? TypeFromField<H> | UnionToTs<T>
    : TypeFromField<H>
  : never;

// Helpers to resolve field-like shapes for input/doc, including arrays of sub documents
type ResolveFieldInput<X> = X extends SchemaDefinition
  ? InferInputType<X>
  : X extends readonly [infer E]
    ? Array<ResolveFieldInput<E>>
    : X extends [infer E]
      ? Array<ResolveFieldInput<E>>
      : X extends FieldType
        ? TypeFromField<X>
        : never;

type ResolveFieldDoc<X> = X extends SchemaDefinition
  ? InferDocType<X>
  : X extends readonly [infer E]
    ? Array<ResolveFieldDoc<E>>
    : X extends [infer E]
      ? Array<ResolveFieldDoc<E>>
      : X extends FieldType
        ? TypeFromField<X>
        : never;

// Value type for defaults (use doc/hydrated types)
type ValueOf<FT extends FieldLike> = ResolveFieldDoc<FT>;

type DefaultOf<FT extends FieldLike> = ValueOf<FT> | (() => ValueOf<FT>);

/**
 * Field options
 */
type FieldOptions<FT extends FieldLike = FieldLike> = (
  | { type: FT }
  | { type: "Union"; of: readonly FieldType[] }
) &
  (
    | { nullable: true; default?: DefaultOf<FT> | null }
    | { nullable?: false | undefined; default?: DefaultOf<FT> }
  ) & {
    required?: boolean;
    unique?: boolean;
  };

/**
 * A field definition can be either a constructor or an object with options
 */
export type FieldDefinition = FieldLike | FieldOptions<FieldLike>;

/**
 * Base input type extractor from field definition
 */
type TypeFromFieldDefInput<F extends FieldDefinition> = F extends {
  type: "Union";
  of: readonly FieldType[];
}
  ? UnionToTs<F["of"]>
  : F extends FieldOptions<infer U>
    ? ResolveFieldInput<U>
    : F extends readonly [infer E]
      ? Array<ResolveFieldInput<E>>
      : F extends [infer E]
        ? Array<ResolveFieldInput<E>>
        : F extends SchemaDefinition
          ? InferInputType<F>
          : F extends FieldType
            ? TypeFromField<F>
            : never;

/**
 * Base document type extractor from field definition
 */
type TypeFromFieldDefDoc<F extends FieldDefinition> = F extends {
  type: "Union";
  of: readonly FieldType[];
}
  ? UnionToTs<F["of"]>
  : F extends FieldOptions<infer U>
    ? ResolveFieldDoc<U>
    : F extends readonly [infer E]
      ? Array<ResolveFieldDoc<E>>
      : F extends [infer E]
        ? Array<ResolveFieldDoc<E>>
        : F extends SchemaDefinition
          ? InferDocType<F>
          : F extends FieldType
            ? TypeFromField<F>
            : never;

/**
 * Apply nullability widening
 */
type WithNullable<F extends FieldDefinition, T> = F extends { nullable: true } ? T | null : T;

/**
 * Input type:
 * - Bare constructor => required
 * - Options: required: true => required
 * - default/unique do not force required
 */
type InputRequiredKeys<Def extends SchemaDefinition> = {
  [K in keyof Def]: Def[K] extends FieldOptions
    ? Def[K] extends { required: true }
      ? K
      : never
    : K;
}[keyof Def];

type InputOptionalKeys<Def extends SchemaDefinition> = Exclude<keyof Def, InputRequiredKeys<Def>>;

export type InferInputType<Def extends SchemaDefinition> = Prettify<
  {
    [K in InputRequiredKeys<Def>]: WithNullable<Def[K], TypeFromFieldDefInput<Def[K]>>;
  } & {
    [K in InputOptionalKeys<Def>]?: WithNullable<Def[K], TypeFromFieldDefInput<Def[K]>>;
  }
>;

/**
 * Document type (hydrated):
 * - Bare constructor => present
 * - required: true => present
 * - unique: true => present (optional: remove if you disagree)
 * - default present => present
 */
type HasDefaultProp<T> = T extends { default: unknown } ? true : false;

type DocRequiredKeys<Def extends SchemaDefinition> = {
  [K in keyof Def]: Def[K] extends FieldOptions
    ? Def[K] extends { required: true }
      ? K
      : Def[K] extends { unique: true }
        ? K
        : HasDefaultProp<Def[K]> extends true
          ? K
          : never
    : K;
}[keyof Def];

type DocOptionalKeys<Def extends SchemaDefinition> = Exclude<keyof Def, DocRequiredKeys<Def>>;

export type InferDocType<Def extends SchemaDefinition> = Prettify<
  {
    [K in DocRequiredKeys<Def>]: WithNullable<Def[K], TypeFromFieldDefDoc<Def[K]>>;
  } & {
    [K in DocOptionalKeys<Def>]?: WithNullable<Def[K], TypeFromFieldDefDoc<Def[K]>>;
  }
>;

/**
 * Back-compat alias
 */
export type InferSchemaType<Def extends SchemaDefinition> = InferDocType<Def>;

export function createSchema<Def extends SchemaDefinition>(definition: Def) {
  return definition;
}
