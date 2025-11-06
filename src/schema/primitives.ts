import { MError } from "../error";
import type { SchemaMeta } from "../types/types.schema";
import { MongsterSchemaInternal, WithDefaultSchema } from "./base";

interface NumberChecks<N> {
  min?: number;
  max?: number;
  enum?: number[];
  default?: N;
  defaultFn?: () => N;
}

export class NumberSchema<TP extends number = number> extends MongsterSchemaInternal<TP, TP> {
  declare $type: TP;
  declare $input: TP;

  #checks: NumberChecks<TP>;

  constructor(checks: NumberChecks<TP> = {}) {
    super();
    this.#checks = checks;
  }

  getChecks(): NumberChecks<TP> {
    return this.#checks;
  }

  min(n: number): NumberSchema<TP> {
    return new NumberSchema<TP>({ ...this.#checks, min: n });
  }

  max(n: number): NumberSchema<TP> {
    return new NumberSchema<TP>({ ...this.#checks, max: n });
  }

  enum<E extends TP>(e: E[]): NumberSchema<E> {
    return new NumberSchema({
      ...this.#checks,
      enum: e,
    }) as unknown as NumberSchema<E>;
  }

  default(d: TP): WithDefaultSchema<TP> {
    const numberSchema = new NumberSchema<TP>({ ...this.#checks, default: d });
    return new WithDefaultSchema(numberSchema);
  }

  defaultFn(fn: () => TP): WithDefaultSchema<TP> {
    const numberSchema = new NumberSchema<TP>({ ...this.#checks, defaultFn: fn });
    return new WithDefaultSchema(numberSchema);
  }

  clone(): this {
    return new NumberSchema<TP>({ ...this.#checks }) as this;
  }

  parse(v: unknown): TP {
    if (typeof v === "undefined") {
      if (typeof this.#checks.default !== "undefined") return this.#checks.default;
      if (typeof this.#checks.defaultFn === "function") return this.#checks.defaultFn();
    }

    if (typeof v !== "number") {
      if (typeof v === "undefined") {
        throw new MError("Expected a number, received undefined");
      }
      throw new MError("Expected a number");
    }

    if (typeof this.#checks.min !== "undefined" && v < this.#checks.min) {
      throw new MError(`Value must be greater than or equal to ${this.#checks.min}`);
    }
    if (typeof this.#checks.max !== "undefined" && v > this.#checks.max) {
      throw new MError(`Value must be less than or equal to ${this.#checks.max}`);
    }

    if (typeof this.#checks.enum !== "undefined" && !this.#checks.enum.includes(v)) {
      throw new MError(`Value must be one of [${this.#checks.enum.join(", ")}]`);
    }

    return v as TP;
  }

  parseForUpdate(v: unknown): TP | undefined {
    if (v === undefined) return undefined;
    return this.parse(v);
  }
}

interface StringChecks<S> {
  min?: number;
  max?: number;
  enum?: string[];
  match?: RegExp;
  default?: S;
  defaultFn?: () => S;
}

export class StringSchema<TP extends string = string> extends MongsterSchemaInternal<TP, TP> {
  declare $type: TP;
  declare $input: TP;

  #checks: StringChecks<TP>;

  constructor(checks: StringChecks<TP> = {}) {
    super();
    this.#checks = checks;
  }

  getChecks(): StringChecks<TP> {
    return this.#checks;
  }

  min(n: number): StringSchema<TP> {
    return new StringSchema<TP>({ ...this.#checks, min: n });
  }

  max(n: number): StringSchema<TP> {
    return new StringSchema<TP>({ ...this.#checks, max: n });
  }

  enum<E extends string>(e: E[]): StringSchema<E> {
    return new StringSchema({
      ...this.#checks,
      enum: e,
    }) as unknown as StringSchema<E>;
  }

  match(r: RegExp): StringSchema<TP> {
    return new StringSchema<TP>({ ...this.#checks, match: r });
  }

  default(d: TP): WithDefaultSchema<TP> {
    const stringSchema = new StringSchema<TP>({ ...this.#checks, default: d });
    return new WithDefaultSchema(stringSchema);
  }

  defaultFn(fn: () => TP): WithDefaultSchema<TP> {
    const stringSchema = new StringSchema<TP>({ ...this.#checks, defaultFn: fn });
    return new WithDefaultSchema(stringSchema);
  }

  clone(): this {
    return new StringSchema<TP>({ ...this.#checks }) as this;
  }

  parse(v: unknown): TP {
    if (typeof v === "undefined") {
      if (typeof this.#checks.default !== "undefined") return this.#checks.default;
      if (typeof this.#checks.defaultFn === "function") return this.#checks.defaultFn();
    }

    if (typeof v !== "string") {
      if (typeof v === "undefined") {
        throw new MError("Expected a string, but received undefined. Field is required.");
      }
      throw new MError("Expected a string");
    }

    const len = v.length;
    if (typeof this.#checks.min === "number" && len < this.#checks.min) {
      throw new MError(`Value must be longer than or equal to ${this.#checks.min} characters`);
    }
    if (typeof this.#checks.max === "number" && len > this.#checks.max) {
      throw new MError(`Value must be shorter than or equal to ${this.#checks.max} characters`);
    }

    if (typeof this.#checks.enum !== "undefined" && !this.#checks.enum.includes(v)) {
      throw new MError(`Value must be one of [${this.#checks.enum.join(", ")}]`);
    }

    if (this.#checks.match instanceof RegExp && !this.#checks.match.test(v)) {
      throw new MError(`Value does not follow pattern ${this.#checks.match}`);
    }

    return v as TP;
  }

  parseForUpdate(v: unknown): TP | undefined {
    if (v === undefined) return undefined;
    return this.parse(v);
  }
}

interface BooleanChecks {
  default?: boolean;
  defaultFn?: () => boolean;
}

export class BooleanSchema extends MongsterSchemaInternal<boolean, boolean> {
  declare $type: boolean;
  declare $input: boolean;

  #checks: BooleanChecks;

  constructor(checks: BooleanChecks = {}) {
    super();
    this.#checks = checks;
  }

  getChecks(): BooleanChecks {
    return this.#checks;
  }

  default(d: boolean): WithDefaultSchema<boolean> {
    const booleanSchema = new BooleanSchema({ ...this.#checks, default: d });
    return new WithDefaultSchema(booleanSchema);
  }

  defaultFn(fn: () => boolean): WithDefaultSchema<boolean> {
    const booleanSchema = new BooleanSchema({ ...this.#checks, defaultFn: fn });
    return new WithDefaultSchema(booleanSchema);
  }

  clone(): this {
    return new BooleanSchema({ ...this.#checks }) as this;
  }

  parse(v: unknown): boolean {
    if (typeof v === "undefined") {
      if (typeof this.#checks.default !== "undefined") return this.#checks.default;
      if (typeof this.#checks.defaultFn === "function") return this.#checks.defaultFn();
    }

    if (typeof v !== "boolean") {
      if (typeof v === "undefined") {
        throw new MError("Expected a boolean, but received undefined. Field is required.");
      }
      throw new MError("Expected a boolean");
    }

    return v;
  }

  parseForUpdate(v: unknown): boolean | undefined {
    if (v === undefined) return undefined;
    return this.parse(v);
  }
}

interface DateChecks {
  min?: Date;
  max?: Date;
  default?: Date;
  defaultFn?: () => Date;
}

export class DateSchema extends MongsterSchemaInternal<Date, Date> {
  declare $type: Date;
  declare $input: Date;

  #checks: DateChecks;

  constructor(checks: DateChecks = {}) {
    super();
    this.#checks = checks;
  }

  getChecks(): DateChecks {
    return this.#checks;
  }

  min(d: Date): DateSchema {
    return new DateSchema({ ...this.#checks, min: d });
  }

  max(d: Date): DateSchema {
    return new DateSchema({ ...this.#checks, max: d });
  }

  default(d: Date): WithDefaultSchema<Date> {
    const dateSchema = new DateSchema({ ...this.#checks, default: d });
    return new WithDefaultSchema(dateSchema);
  }

  defaultFn(fn: () => Date): WithDefaultSchema<Date> {
    const dateSchema = new DateSchema({ ...this.#checks, defaultFn: fn });
    return new WithDefaultSchema(dateSchema);
  }

  clone(): this {
    return new DateSchema({ ...this.#checks }) as this;
  }

  parse(v: unknown): Date {
    if (typeof v === "undefined") {
      if (typeof this.#checks.default !== "undefined") return this.#checks.default;
      if (typeof this.#checks.defaultFn === "function") return this.#checks.defaultFn();
    }

    let out: Date;
    if (v instanceof Date) out = v;
    else if (typeof v === "string" || typeof v === "number") out = new Date(v);
    else if (typeof v === "undefined") {
      throw new MError(
        `Expected a valid (date | date string | number), but received undefined. Field is required.`,
      );
    } else {
      throw new MError(`Expected a valid (date | date string | number)`);
    }

    const timeVal = out.getTime();

    if (Number.isNaN(timeVal)) throw new MError(`Invalid date`);

    if (typeof this.#checks.min !== "undefined" && timeVal < this.#checks.min.getTime()) {
      throw new MError(`Value must be after or equal to ${this.#checks.min.toISOString()}`);
    }
    if (typeof this.#checks.max !== "undefined" && timeVal > this.#checks.max.getTime()) {
      throw new MError(`Value must be before or equal to ${this.#checks.max.toISOString()}`);
    }

    return out;
  }

  parseForUpdate(v: unknown): Date | undefined {
    if (v === undefined) return undefined;
    return this.parse(v);
  }

  /**
   * Create a TTL index on the field
   * @param s The TTL index expireAfterSeconds value
   */
  ttl(s: number): DateSchema {
    const clone = this.clone();
    const currMeta = this.getIdxMeta();
    const newMeta: SchemaMeta<Date> = {
      options: { ...currMeta.options, expireAfterSeconds: s },
      index: currMeta.index ?? 1,
    };
    clone.setIdxMeta(newMeta);
    return clone;
  }

  /**
   * Alias to `.ttl()`
   */
  expires(s: number): DateSchema {
    return this.ttl(s);
  }
}
