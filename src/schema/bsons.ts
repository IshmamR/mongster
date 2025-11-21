import { Binary, Decimal128, ObjectId } from "mongodb";
import { MError } from "../error";
import { MongsterSchemaInternal, WithDefaultSchema } from "./base";

interface ObjectIdChecks {
  default?: "generate" | ObjectId;
  defaultFn?: () => ObjectId;
}

export class ObjectIdSchema extends MongsterSchemaInternal<ObjectId, ObjectId> {
  declare $type: ObjectId;
  declare $input: ObjectId;
  declare $brand: "ObjectIdSchema";

  #checks: ObjectIdChecks;

  constructor(checks: ObjectIdChecks = {}) {
    super();
    this.#checks = checks;
  }

  getChecks(): ObjectIdChecks {
    return this.#checks;
  }

  default(d: "generate" | ObjectId): WithDefaultSchema<ObjectId> {
    const objIdSchema = new ObjectIdSchema({ ...this.#checks, default: d });
    return new WithDefaultSchema(objIdSchema);
  }

  defaultFn(fn: () => ObjectId): WithDefaultSchema<ObjectId> {
    const objIdSchema = new ObjectIdSchema({ ...this.#checks, defaultFn: fn });
    return new WithDefaultSchema(objIdSchema);
  }

  clone(): this {
    return new ObjectIdSchema({ ...this.#checks }) as this;
  }

  parse(v: unknown): ObjectId {
    if (typeof v === "undefined") {
      if (typeof this.#checks.default !== "undefined") {
        if (this.#checks.default === "generate") return new ObjectId();
        return this.#checks.default;
      }
      if (typeof this.#checks.defaultFn === "function") return this.#checks.defaultFn();
    }

    if (!(v instanceof ObjectId)) throw new MError(`Expected an ObjectId`);
    return v;
  }

  parseForUpdate(v: unknown): ObjectId | undefined {
    if (v === undefined) return undefined;
    return this.parse(v);
  }
}

interface Decimal128Checks {
  default?: Decimal128;
  defaultFn?: () => Decimal128;
}

export class Decimal128Schema extends MongsterSchemaInternal<Decimal128, Decimal128> {
  declare $type: Decimal128;
  declare $input: Decimal128;
  declare $brand: "Decimal128Schema";

  #checks: Decimal128Checks;

  constructor(checks: Decimal128Checks = {}) {
    super();
    this.#checks = checks;
  }

  getChecks(): Decimal128Checks {
    return this.#checks;
  }

  default(d: Decimal128): WithDefaultSchema<Decimal128> {
    const decSchema = new Decimal128Schema({ ...this.#checks, default: d });
    return new WithDefaultSchema(decSchema);
  }

  defaultFn(fn: () => Decimal128): WithDefaultSchema<Decimal128> {
    const decSchema = new Decimal128Schema({ ...this.#checks, defaultFn: fn });
    return new WithDefaultSchema(decSchema);
  }

  clone(): this {
    return new Decimal128Schema({ ...this.#checks }) as this;
  }

  parse(v: unknown): Decimal128 {
    if (typeof v === "undefined") {
      if (typeof this.#checks.default !== "undefined") return this.#checks.default;
      if (typeof this.#checks.defaultFn === "function") return this.#checks.defaultFn();
    }

    if (!(v instanceof Decimal128)) throw new MError("Expected a Decimal128");
    return v;
  }

  parseForUpdate(v: unknown): Decimal128 | undefined {
    if (v === undefined) return undefined;
    return this.parse(v);
  }
}

const BSON_SUB_TYPE = {
  SUBTYPE_DEFAULT: Binary.SUBTYPE_DEFAULT,
  SUBTYPE_FUNCTION: Binary.SUBTYPE_FUNCTION,
  SUBTYPE_BYTE_ARRAY: Binary.SUBTYPE_BYTE_ARRAY,
  SUBTYPE_UUID: Binary.SUBTYPE_UUID,
  SUBTYPE_MD5: Binary.SUBTYPE_MD5,
  SUBTYPE_ENCRYPTED: Binary.SUBTYPE_ENCRYPTED,
  SUBTYPE_COLUMN: Binary.SUBTYPE_COLUMN,
  SUBTYPE_SENSITIVE: Binary.SUBTYPE_SENSITIVE,
  SUBTYPE_VECTOR: Binary.SUBTYPE_VECTOR,
  SUBTYPE_USER_DEFINED: Binary.SUBTYPE_USER_DEFINED,
} as const;
const bsonSubTypes = Object.values(BSON_SUB_TYPE);
type BSONSubtype = (typeof bsonSubTypes)[number];

function isValidBsonSubtype(x: unknown): x is BSONSubtype {
  return typeof x === "number" && bsonSubTypes.includes(x as BSONSubtype);
}

interface BinaryChecks {
  min?: number;
  max?: number;
  subType: BSONSubtype;
  default?: Binary;
  defaultFn?: () => Binary;
}

export class BinarySchema extends MongsterSchemaInternal<Binary, Binary> {
  declare $type: Binary;
  declare $input: Binary;
  declare $brand: "BinarySchema";

  #checks: BinaryChecks;

  constructor(checks: BinaryChecks = { subType: Binary.SUBTYPE_DEFAULT }) {
    super();
    this.#checks = checks;
  }

  getChecks(): BinaryChecks {
    return this.#checks;
  }

  min(n: number): BinarySchema {
    return new BinarySchema({ ...this.#checks, min: n });
  }

  max(n: number): BinarySchema {
    return new BinarySchema({ ...this.#checks, max: n });
  }

  bsonSubType(b: BSONSubtype): BinarySchema {
    if (!isValidBsonSubtype(b)) throw new MError(`Invalid BSON subtype argument: ${b}`);
    return new BinarySchema({ ...this.#checks, subType: b });
  }

  default(d: Binary): WithDefaultSchema<Binary> {
    const binSchema = new BinarySchema({ ...this.#checks, default: d });
    return new WithDefaultSchema(binSchema);
  }

  defaultFn(fn: () => Binary): WithDefaultSchema<Binary> {
    const binSchema = new BinarySchema({ ...this.#checks, defaultFn: fn });
    return new WithDefaultSchema(binSchema);
  }

  clone(): this {
    return new BinarySchema({ ...this.#checks }) as this;
  }

  #toBuffer(v: unknown): Buffer {
    if (Buffer.isBuffer(v)) return v;
    if (v instanceof Uint8Array) return Buffer.from(v);
    if (v instanceof Binary) return Buffer.from(v.buffer);
    if (Array.isArray(v) && v.every((x) => Number.isInteger(x) && x >= 0 && x <= 255)) {
      return Buffer.from(v as number[]);
    }
    throw new MError("Expected a (Binary | Buffer)");
  }

  parse(v: unknown): Binary {
    if (typeof v === "undefined") {
      if (typeof this.#checks.default !== "undefined") v = this.#checks.default;
      else if (typeof this.#checks.defaultFn === "function") v = this.#checks.defaultFn();
    }

    const buf = this.#toBuffer(v);
    const len = buf.length;
    if (typeof this.#checks.min !== "undefined" && len < this.#checks.min) {
      throw new MError(`Buffer is too short (min ${this.#checks.min})`);
    }
    if (typeof this.#checks.max !== "undefined" && len > this.#checks.max) {
      throw new MError(`Buffer is too long (max ${this.#checks.max})`);
    }

    if (v instanceof Binary) {
      if (v.sub_type !== this.#checks.subType) {
        throw new MError(
          `Invalid Binary subtype: expected ${this.#checks.subType}, got ${v.sub_type}`,
        );
      }
      return v;
    }

    return new Binary(buf, this.#checks.subType);
  }

  parseForUpdate(v: unknown): Binary | undefined {
    if (v === undefined) return undefined;
    return this.parse(v);
  }

  getJsonSchema(): any {
    const hasMin = typeof this.#checks.min === "number";
    const hasMax = typeof this.#checks.max === "number";

    const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    const property: any = {
      type: "object",
      properties: {
        bytes: { type: "string", pattern: base64Regex.source },
        subtype: { type: "integer", const: this.#checks.subType },
      },
      required: ["bytes", "subtype"],
      additionalProperties: false,
    };

    if (typeof this.#checks.default !== "undefined") {
      property.properties.bytes.default = this.#checks.default.toString("base64");
    }

    if (!hasMin && !hasMax) return property;

    const ceilDiv = (n: number, d: number) => Math.floor((n + d - 1) / d);
    const floorDiv = (n: number, d: number) => Math.floor(n / d);

    const min = hasMin ? (this.#checks.min as number) : 0;
    const max = hasMax ? (this.#checks.max as number) : Number.MAX_SAFE_INTEGER;

    if (min === 0 && max === 0) {
      property.properties.bytes.pattern = "^$";
      return property;
    }

    const branches: { type: string; pattern: string }[] = [];

    // r = 0 (no padding)
    {
      const kMin = ceilDiv(min, 3);
      const kMax = floorDiv(max, 3);
      if (kMin <= kMax) {
        branches.push({
          type: "string",
          pattern: `^(?:[A-Za-z0-9+/]{4}){${kMin},${kMax}}$`,
        });
      }
    }

    // r = 1 (==)
    {
      let kMin = ceilDiv(min - 1, 3);
      const kMax = floorDiv(max - 1, 3);
      if (kMin < 0) kMin = 0;
      if (kMax >= 0 && kMin <= kMax) {
        branches.push({
          type: "string",
          pattern: `^(?:[A-Za-z0-9+/]{4}){${kMin},${kMax}}[A-Za-z0-9+/]{2}==$`,
        });
      }
    }

    // r = 2 (=)
    {
      let kMin = ceilDiv(min - 2, 3);
      const kMax = floorDiv(max - 2, 3);
      if (kMin < 0) kMin = 0;
      if (kMax >= 0 && kMin <= kMax) {
        branches.push({
          type: "string",
          pattern: `^(?:[A-Za-z0-9+/]{4}){${kMin},${kMax}}[A-Za-z0-9+/]{3}=$`,
        });
      }
    }

    if (min === 0 && max > 0) {
      branches.unshift({ type: "string", pattern: "^$" });
    }

    if (!branches.length) {
      property.properties.bytes = { not: {} } as any;
    } else if (branches.length === 1 && !!branches[0]) {
      property.properties.bytes = branches[0];
    } else {
      property.properties.bytes = { oneOf: branches } as any;
    }

    return property;
  }
}
