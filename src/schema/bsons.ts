import { Binary, Decimal128, ObjectId } from "bson";
import { MError } from "../error";
import { MongsterSchemaBase } from "./base";

interface ObjectIdChecks {
  default?: "generate" | ObjectId;
}

export class ObjectIdSchema extends MongsterSchemaBase<ObjectId> {
  declare $type: ObjectId;

  #checks: ObjectIdChecks;

  constructor(checks: ObjectIdChecks = {}) {
    super();
    this.#checks = checks;
  }

  default(d: "generate" | ObjectId): ObjectIdSchema {
    return new ObjectIdSchema({ ...this.#checks, default: d });
  }

  clone(): this {
    return new ObjectIdSchema({ ...this.#checks }) as this;
  }

  parse(v: unknown): ObjectId {
    if (typeof v === "undefined" && typeof this.#checks.default !== "undefined") {
      if (this.#checks.default === "generate") return new ObjectId();
      return this.#checks.default;
    }

    if (!(v instanceof ObjectId)) throw new MError(`Expected an ObjectId`);
    return v;
  }
}

interface Decimal128Checks {
  default?: Decimal128;
}

export class Decimal128Schema extends MongsterSchemaBase<Decimal128> {
  declare $type: Decimal128;

  #checks: Decimal128Checks;

  constructor(checks: Decimal128Checks = {}) {
    super();
    this.#checks = checks;
  }

  default(d: Decimal128): Decimal128Schema {
    return new Decimal128Schema({ ...this.#checks, default: d });
  }

  clone(): this {
    return new Decimal128Schema({ ...this.#checks }) as this;
  }

  parse(v: unknown): Decimal128 {
    if (typeof v === "undefined" && typeof this.#checks.default !== "undefined") {
      return this.#checks.default;
    }

    if (!(v instanceof Decimal128)) throw new MError("Expected a Decimal128");
    return v;
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

type BinaryInput = Buffer | Uint8Array | Binary;

interface BinaryChecks<B> {
  min?: number;
  max?: number;
  subType: BSONSubtype;
  default?: B;
}

export class BinarySchema<TA extends BinaryInput = BinaryInput> extends MongsterSchemaBase<TA> {
  declare $type: TA;

  #checks: BinaryChecks<TA>;

  constructor(checks: BinaryChecks<TA> = { subType: Binary.SUBTYPE_DEFAULT }) {
    super();
    this.#checks = checks;
  }

  min(n: number): BinarySchema<TA> {
    return new BinarySchema<TA>({ ...this.#checks, min: n });
  }

  max(n: number): BinarySchema<TA> {
    return new BinarySchema({ ...this.#checks, max: n });
  }

  bsonSubType(b: BSONSubtype): BinarySchema<TA> {
    if (!isValidBsonSubtype(b)) throw new MError(`Invalid BSON subtype argument: ${b}`);
    return new BinarySchema({ ...this.#checks, subType: b });
  }

  default(d: TA): BinarySchema<TA> {
    return new BinarySchema({ ...this.#checks, default: d });
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

  parse(v: unknown): TA {
    if (typeof v === "undefined" && typeof this.#checks.default !== "undefined") {
      v = this.#checks.default;
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
      return v as TA;
    }

    return new Binary(buf, this.#checks.subType) as TA;
  }
}
