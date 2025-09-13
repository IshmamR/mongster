import type { FindCursor } from "mongodb";
import type { PositiveNumber } from "../../types/types.common";
import { limitFunc } from "./limit";
import { projectFunc, type StrictProjection } from "./project";
import { type SelectionFields, selectFunc } from "./select";
import { skipFunc } from "./skip";
import { type SchemaSort, sortFunc } from "./sort";

type PromiseOnFulfilled<Res> = ((value: Res[]) => Res[] | PromiseLike<Res[]>) | null | undefined;
type PromiseOnRejected = ((reason: unknown) => PromiseLike<never>) | null | undefined;

export class Query<T> {
  #cursor: FindCursor<T>;

  constructor(cursor: FindCursor<T>) {
    this.#cursor = cursor;
  }

  sort(sort: SchemaSort<T>) {
    this.#cursor = sortFunc(this.#cursor, sort);
    return this;
  }

  limit<N extends number>(n: PositiveNumber<N>) {
    this.#cursor = limitFunc(this.#cursor, n);
    return this;
  }

  skip<N extends number>(n: PositiveNumber<N>) {
    this.#cursor = skipFunc(this.#cursor, n);
    return this;
  }

  project<P extends StrictProjection<T>>(projection: P) {
    const projectedCursor = projectFunc(this.#cursor, projection);
    return new Query(projectedCursor);
  }

  /**
   * example usages:
   * .select(["age", name"]) , .select(["-dob"])
   */
  select<SF extends SelectionFields<T>>(fields: SF) {
    const projectedCursor = selectFunc(this.#cursor, fields);
    return new Query(projectedCursor);
  }

  exec() {
    return this.#cursor.toArray();
  }

  // biome-ignore lint/suspicious/noThenProperty: cz I need it
  then(resolve?: PromiseOnFulfilled<T>, reject?: PromiseOnRejected) {
    return this.exec().then(resolve, reject);
  }

  catch(reject: PromiseOnRejected) {
    return this.exec().catch(reject);
  }
}
