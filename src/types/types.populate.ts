import type { Document, Filter } from "mongodb";
import type { RefObjectIdSchema } from "../schema/bsons";
import type { Prettify } from "./types.common";
import type {
  AllProjKeys,
  ProjectionFromExclusionKeys,
  ProjectionFromInclusionKeys,
} from "./types.query";

export interface PopulateSpec {
  field: string;
  select?: readonly string[];
  excludeId?: boolean;
}

export interface FindQueryHooks<OT extends Document = Document> {
  preExec: (ctx: { filter: Filter<OT> }) => Promise<{ filter: Filter<OT> }>;
  postExec: (ctx: { filter: Filter<OT>; result: OT[] }) => Promise<void>;
}

export interface FindOneQueryHooks<OT extends Document = Document> {
  preExec: (filter: Filter<OT>) => Promise<Filter<OT>>;
  postExec: (filter: Filter<OT>, result: OT | null) => Promise<void>;
}

export interface RefMeta {
  getCollectionName: () => string;
}

type RefModelOutput<M> = M extends { $outType: infer OT extends Document } ? OT : never;

type RefOutputForField<
  Shape extends Record<string, unknown>,
  K extends string,
> = K extends keyof Shape
  ? Shape[K] extends RefObjectIdSchema<infer M>
    ? RefModelOutput<M>
    : never
  : never;

export type RefFieldKeys<Shape extends Record<string, unknown>> = Extract<
  { [K in keyof Shape]: Shape[K] extends RefObjectIdSchema<any> ? K : never }[keyof Shape],
  string
>;

export type PopulateSelectKeys<
  Shape extends Record<string, unknown>,
  K extends RefFieldKeys<Shape>,
> = Extract<AllProjKeys<RefOutputForField<Shape, K>>, string>;

type SelectedRefOutput<
  Doc extends Document,
  Select extends readonly AllProjKeys<Doc>[] | undefined,
  ExcludeId extends boolean | undefined,
> = [Select] extends [readonly []]
  ? ExcludeId extends true
    ? "_id" extends AllProjKeys<Doc>
      ? ProjectionFromExclusionKeys<Doc, Extract<"_id", AllProjKeys<Doc>>>
      : Doc
    : "_id" extends keyof Doc
      ? Pick<Doc, "_id">
      : Record<string, never>
  : [Select] extends [readonly AllProjKeys<Doc>[]]
    ? ExcludeId extends true
      ? Prettify<
          Omit<ProjectionFromInclusionKeys<Doc, Extract<Select[number], AllProjKeys<Doc>>>, "_id">
        >
      : ProjectionFromInclusionKeys<Doc, Extract<Select[number], AllProjKeys<Doc>>>
    : Doc;

export type PopulateResult<
  Doc extends Document,
  Shape extends Record<string, unknown>,
  K extends RefFieldKeys<Shape>,
  Select extends readonly PopulateSelectKeys<Shape, K>[] | undefined,
  ExcludeId extends boolean | undefined,
> = Prettify<
  Omit<Doc, K> & {
    [P in K]: SelectedRefOutput<RefOutputForField<Shape, P>, Select, ExcludeId> | null;
  }
>;

export interface PopulateOptions<
  Shape extends Record<string, unknown>,
  K extends RefFieldKeys<Shape>,
  Select extends readonly PopulateSelectKeys<Shape, K>[] | undefined,
  ExcludeId extends boolean | undefined,
> {
  select?: Select;
  excludeId?: ExcludeId;
}
