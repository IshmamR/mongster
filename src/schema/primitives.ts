import { MongsTerror } from "../error";
import type { PositiveNumber } from "../types/types.common";
import { MongsterSchemaBase } from "./base";

type NumberChecks = {
  min?: number;
  max?: number;
  enum?: number[];
  default?: number;
};

type NumberTransforms = {
  toFixed?: number;
};

export class NumberSchema extends MongsterSchemaBase<number> {
  declare $type: number;

  constructor(
    private checks: NumberChecks = {},
    private transforms: NumberTransforms = {},
  ) {
    super();
  }

  protected clone(): this {
    return new NumberSchema({ ...this.checks }, { ...this.transforms }) as this;
  }

  min(n: number): NumberSchema {
    return new NumberSchema({ ...this.checks, min: n }, this.transforms);
  }

  max(n: number): NumberSchema {
    return new NumberSchema({ ...this.checks, max: n }, this.transforms);
  }

  enum(e: number[]): NumberSchema {
    return new NumberSchema({ ...this.checks, enum: e }, this.transforms);
  }

  default(d: number): NumberSchema {
    return new NumberSchema({ ...this.checks, default: d }, this.transforms);
  }

  toFixed<N extends number>(n: PositiveNumber<N>): NumberSchema {
    return new NumberSchema(this.checks, {
      ...this.transforms,
      toFixed: n as N,
    });
  }

  parse(v: unknown): number {
    if (typeof v === "undefined" && typeof this.checks.default !== "undefined") {
      return this.checks.default;
    }

    if (typeof v !== "number") throw new MongsTerror("Expected a number");

    if (typeof this.checks.min !== "undefined" && v < this.checks.min) {
      throw new MongsTerror(`Value must be greater than or equal to ${this.checks.min}`);
    }
    if (typeof this.checks.max !== "undefined" && v > this.checks.max) {
      throw new MongsTerror(`Value must be less than or equal to ${this.checks.max}`);
    }

    if (typeof this.checks.enum !== "undefined" && !this.checks.enum.includes(v)) {
      throw new MongsTerror(`Value must be one of [${this.checks.enum.join(", ")}]`);
    }

    let out = v;
    for (const tk of Object.keys(this.transforms) as Array<keyof NumberTransforms>) {
      if (tk === "toFixed") out = Number(out.toFixed(this.transforms.toFixed));
    }

    return v;
  }
}

type StringChecks = {
  min?: number;
  max?: number;
  enum?: string[];
  match?: RegExp;
  default?: string; // default value
};

type StringTransforms = {
  lowercase?: boolean;
  uppercase?: boolean;
  trim?: boolean;
};

export class StringSchema extends MongsterSchemaBase<string> {
  declare $type: string;

  constructor(
    private checks: StringChecks = {},
    private transforms: StringTransforms = {},
  ) {
    super();
  }

  protected clone(): this {
    return new StringSchema({ ...this.checks }, { ...this.transforms }) as this;
  }

  min<N extends number>(n: PositiveNumber<N>): StringSchema {
    return new StringSchema({ ...this.checks, min: n as N }, this.transforms);
  }

  max<N extends number>(n: PositiveNumber<N>): StringSchema {
    return new StringSchema({ ...this.checks, max: n as N }, this.transforms);
  }

  enum(e: string[]): StringSchema {
    return new StringSchema({ ...this.checks, enum: e }, this.transforms);
  }

  match(r: RegExp): StringSchema {
    return new StringSchema({ ...this.checks, match: r }, this.transforms);
  }

  default(d: string): StringSchema {
    return new StringSchema({ ...this.checks, default: d }, this.transforms);
  }

  lowercase(): StringSchema {
    return new StringSchema(this.checks, {
      ...this.transforms,
      lowercase: true,
    });
  }

  uppercase(): StringSchema {
    return new StringSchema(this.checks, {
      ...this.transforms,
      uppercase: true,
    });
  }

  trim(): StringSchema {
    return new StringSchema(this.checks, { ...this.transforms, trim: true });
  }

  parse(v: unknown): string {
    if (typeof v === "undefined" && typeof this.checks.default !== "undefined") {
      return this.checks.default;
    }

    if (typeof v !== "string") throw new MongsTerror("Expected a string");

    const len = v.length;
    if (typeof this.checks.min === "number" && len < this.checks.min) {
      throw new MongsTerror(`Value must be longer than or equal to ${this.checks.min} characters`);
    }
    if (typeof this.checks.max === "number" && len > this.checks.max) {
      throw new MongsTerror(`Value must be shorter than or equal to ${this.checks.max} characters`);
    }

    if (typeof this.checks.enum !== "undefined" && !this.checks.enum.includes(v)) {
      throw new MongsTerror(`Value must be one of [${this.checks.enum.join(", ")}]`);
    }

    if (this.checks.match instanceof RegExp && !this.checks.match.test(v)) {
      throw new MongsTerror(`Value does not follow pattern ${this.checks.match}`);
    }

    let out = v;
    for (const tk of Object.keys(this.transforms) as Array<keyof StringTransforms>) {
      if (tk === "lowercase") out = out.toLowerCase();
      if (tk === "uppercase") out = out.toUpperCase();
      if (tk === "trim") out = out.trim();
    }

    return out;
  }
}

type BooleanChecks = {
  default?: boolean;
};

export class BooleanSchema extends MongsterSchemaBase<boolean> {
  declare $type: boolean;

  constructor(private checks: BooleanChecks = {}) {
    super();
  }

  protected clone(): this {
    return new BooleanSchema({ ...this.checks }) as this;
  }

  default(d: boolean): BooleanSchema {
    return new BooleanSchema({ ...this.checks, default: d });
  }

  parse(v: unknown): boolean {
    if (typeof v === "undefined" && typeof this.checks.default !== "undefined") {
      return this.checks.default;
    }

    if (typeof v !== "boolean") throw new MongsTerror("Expected a boolean");

    return v;
  }
}

type DateChecks = {
  min?: Date;
  max?: Date;
  default?: Date;
};

export class DateSchema extends MongsterSchemaBase<Date> {
  declare $type: Date;

  constructor(private checks: DateChecks = {}) {
    super();
  }

  protected clone(): this {
    return new DateSchema({ ...this.checks }) as this;
  }

  min(d: Date): DateSchema {
    return new DateSchema({ ...this.checks, min: d });
  }

  max(d: Date): DateSchema {
    return new DateSchema({ ...this.checks, max: d });
  }

  default(d: Date): DateSchema {
    return new DateSchema({ ...this.checks, default: d });
  }

  parse(v: unknown): Date {
    if (typeof v === "undefined" && typeof this.checks.default !== "undefined") {
      return this.checks.default;
    }

    let out: Date;
    if (v instanceof Date) out = v;
    else if (typeof v === "string" || typeof v === "number") out = new Date(v);
    else throw new MongsTerror(`Expected a valid (date | date string | number)`);

    const timeVal = out.getTime();

    if (Number.isNaN(timeVal)) throw new MongsTerror(`Invalid date`);

    if (typeof this.checks.min !== "undefined" && timeVal < this.checks.min.getTime()) {
      throw new MongsTerror(`Value must be after or equal to ${this.checks.min.toISOString()}`);
    }
    if (typeof this.checks.max !== "undefined" && timeVal > this.checks.max.getTime()) {
      throw new MongsTerror(`Value must be before or equal to ${this.checks.max.toISOString()}`);
    }

    return out;
  }

  /**
   * Create a TTL index on the field
   * @param s The TTL index expireAfterSeconds value
   */
  ttl<N extends number>(s: PositiveNumber<N>): DateSchema {
    const next = new DateSchema({ ...this.checks });
    next.meta.index ??= 1;
    next.meta.options = { ...next.meta.options, expireAfterSeconds: s as N };
    return next;
  }

  /**
   * Alias to `.ttl()`
   */
  expires<N extends number>(s: PositiveNumber<N>): DateSchema {
    return this.ttl(s);
  }
}
