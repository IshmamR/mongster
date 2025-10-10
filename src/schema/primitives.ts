import { MError } from "../error";
import type { SchemaMeta } from "../types/types.schema";
import { MongsterSchemaBase } from "./base";

interface NumberChecks<N> {
  min?: number;
  max?: number;
  enum?: number[];
  default?: N;
}

export class NumberSchema<TP extends number = number> extends MongsterSchemaBase<TP> {
  declare $type: TP;

  #checks: NumberChecks<TP>;

  constructor(checks: NumberChecks<TP> = {}) {
    super();
    this.#checks = checks;
  }

  min(n: number): NumberSchema<TP> {
    this.#checks.min = n;
    return this;
  }

  max(n: number): NumberSchema<TP> {
    this.#checks.max = n;
    return this;
  }

  enum<E extends TP>(e: E[]): NumberSchema<E> {
    this.#checks.enum = e;
    return this as unknown as NumberSchema<E>;
  }

  default(d: TP): NumberSchema<TP> {
    this.#checks.default = d;
    return this;
  }

  parse(v: unknown): TP {
    if (typeof v === "undefined" && typeof this.#checks.default !== "undefined") {
      return this.#checks.default;
    }

    if (typeof v !== "number") {
      if (typeof v === "undefined") {
        throw new MError("Expected a number, but received undefined. Field is required.");
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
}

interface StringChecks<S> {
  min?: number;
  max?: number;
  enum?: string[];
  match?: RegExp;
  default?: S;
}

export class StringSchema<TP extends string = string> extends MongsterSchemaBase<TP> {
  declare $type: TP;

  #checks: StringChecks<TP>;

  constructor(checks: StringChecks<TP> = {}) {
    super();
    this.#checks = checks;
  }

  min(n: number): StringSchema<TP> {
    this.#checks.min = n;
    return this;
  }

  max(n: number): StringSchema<TP> {
    this.#checks.max = n;
    return this;
  }

  enum<E extends TP>(e: E[]): StringSchema<E> {
    this.#checks.enum = e;
    return this as unknown as StringSchema<E>;
  }

  match(r: RegExp): StringSchema<TP> {
    this.#checks.match = r;
    return this;
  }

  default(d: TP): StringSchema<TP> {
    this.#checks.default = d;
    return this;
  }

  parse(v: unknown): TP {
    if (typeof v === "undefined" && typeof this.#checks.default !== "undefined") {
      return this.#checks.default;
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
}

interface BooleanChecks {
  default?: boolean;
}

export class BooleanSchema extends MongsterSchemaBase<boolean> {
  declare $type: boolean;

  #checks: BooleanChecks;

  constructor(checks: BooleanChecks = {}) {
    super();
    this.#checks = checks;
  }

  default(d: boolean): BooleanSchema {
    this.#checks.default = d;
    return this;
  }

  parse(v: unknown): boolean {
    if (typeof v === "undefined" && typeof this.#checks.default !== "undefined") {
      return this.#checks.default;
    }

    if (typeof v !== "boolean") {
      if (typeof v === "undefined") {
        throw new MError("Expected a boolean, but received undefined. Field is required.");
      }
      throw new MError("Expected a boolean");
    }

    return v;
  }
}

interface DateChecks {
  min?: Date;
  max?: Date;
  default?: Date;
}

export class DateSchema extends MongsterSchemaBase<Date> {
  declare $type: Date;

  #checks: DateChecks;

  constructor(checks: DateChecks = {}) {
    super();
    this.#checks = checks;
  }

  min(d: Date): DateSchema {
    this.#checks.min = d;
    return this;
  }

  max(d: Date): DateSchema {
    this.#checks.max = d;
    return this;
  }

  default(d: Date): DateSchema {
    this.#checks.default = d;
    return this;
  }

  parse(v: unknown): Date {
    if (typeof v === "undefined" && typeof this.#checks.default !== "undefined") {
      return this.#checks.default;
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

  /**
   * Create a TTL index on the field
   * @param s The TTL index expireAfterSeconds value
   */
  ttl(s: number): DateSchema {
    const currMeta = this.getMeta();
    const newMeta: SchemaMeta<Date> = {
      options: { ...currMeta.options, expireAfterSeconds: s },
      index: currMeta.index ?? 1,
    };
    this.setMeta(newMeta);
    return this;
  }

  /**
   * Alias to `.ttl()`
   */
  expires(s: number): DateSchema {
    return this.ttl(s);
  }
}
