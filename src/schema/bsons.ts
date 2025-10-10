import { Binary, Decimal128, ObjectId } from "bson";
import { MError } from "../error";
import { MongsterSchemaBase } from "./base";

type ObjectIdChecks = {
  default?: "generate" | ObjectId;
};

export class ObjectIdSchema extends MongsterSchemaBase<ObjectId> {
  declare $type: ObjectId;

  constructor(private checks: ObjectIdChecks = {}) {
    super();
  }

  protected clone(): this {
    return new ObjectIdSchema({ ...this.checks }) as this;
  }

  default(d: "generate" | ObjectId): ObjectIdSchema {
    return new ObjectIdSchema({ ...this.checks, default: d });
  }

  parse(v: unknown): ObjectId {
    if (typeof v === "undefined" && typeof this.checks.default !== "undefined") {
      if (this.checks.default === "generate") return new ObjectId();
      else return this.checks.default;
    }

    if (!(v instanceof ObjectId)) throw new MError(`Expected an ObjectId`);

    return v;
  }
}

type Decimal128Checks = {
  default?: Decimal128;
};

export class Decimal128Schema extends MongsterSchemaBase<Decimal128> {
  declare $type: Decimal128;

  constructor(private checks: Decimal128Checks = {}) {
    super();
  }

  protected clone(): this {
    return new Decimal128Schema({ ...this.checks }) as this;
  }

  default(d: Decimal128): Decimal128Schema {
    return new Decimal128Schema({ ...this.checks, default: d });
  }

  parse(v: unknown): Decimal128 {
    if (typeof v === "undefined" && typeof this.checks.default !== "undefined") {
      return this.checks.default;
    }

    if (!(v instanceof Decimal128)) throw new MError("Expected a Decimal128");

    return v;
  }
}

type BSONSubtype =
  | typeof Binary.SUBTYPE_DEFAULT
  | typeof Binary.SUBTYPE_FUNCTION
  | typeof Binary.SUBTYPE_BYTE_ARRAY
  | typeof Binary.SUBTYPE_UUID
  | typeof Binary.SUBTYPE_MD5
  | typeof Binary.SUBTYPE_ENCRYPTED
  | typeof Binary.SUBTYPE_COLUMN
  | typeof Binary.SUBTYPE_SENSITIVE
  | typeof Binary.SUBTYPE_VECTOR
  | typeof Binary.SUBTYPE_USER_DEFINED;

function isValidBsonSubtype(x: unknown): x is BSONSubtype {
  return (
    typeof x === "number" &&
    [
      Binary.SUBTYPE_DEFAULT,
      Binary.SUBTYPE_FUNCTION,
      Binary.SUBTYPE_BYTE_ARRAY,
      Binary.SUBTYPE_UUID,
      Binary.SUBTYPE_MD5,
      Binary.SUBTYPE_ENCRYPTED,
      Binary.SUBTYPE_COLUMN,
      Binary.SUBTYPE_SENSITIVE,
      Binary.SUBTYPE_VECTOR,
      Binary.SUBTYPE_USER_DEFINED,
    ].includes(x)
  );
}

type BinaryInput = Buffer | Uint8Array | Binary | number[];

type BinaryChecks<DB> = {
  min?: number;
  max?: number;
  subType: BSONSubtype;
  default?: DB;
};

export class BinarySchema<
  TA extends BinaryInput = Buffer | Uint8Array | Binary,
> extends MongsterSchemaBase<TA> {
  declare $type: TA;

  constructor(private checks: BinaryChecks<TA> = { subType: Binary.SUBTYPE_DEFAULT }) {
    super();
  }

  protected clone(): this {
    return new BinarySchema({ ...this.checks }) as this;
  }

  min(n: number): BinarySchema<TA> {
    return new BinarySchema({ ...this.checks, min: n });
  }

  max(n: number): BinarySchema<TA> {
    return new BinarySchema({ ...this.checks, max: n });
  }

  bsonSubType(b: BSONSubtype): BinarySchema<TA> {
    if (!isValidBsonSubtype(b)) throw new MError(`Invalid BSON subtype: ${b}`);

    return new BinarySchema({ ...this.checks, subType: b });
  }

  default(d: TA): BinarySchema<TA> {
    return new BinarySchema({ ...this.checks, default: d });
  }

  private toBuffer(v: unknown): Buffer {
    if (Buffer.isBuffer(v)) return v;
    if (v instanceof Uint8Array) return Buffer.from(v);
    if (v instanceof Binary) return Buffer.from(v.buffer);
    if (Array.isArray(v) && v.every((x) => Number.isInteger(x) && x >= 0 && x <= 255)) {
      return Buffer.from(v as number[]);
    }
    throw new MError("Expected a (Binary | Buffer)");
  }

  parse(v: unknown): TA {
    if (typeof v === "undefined" && typeof this.checks.default !== "undefined") {
      v = this.checks.default;
    }

    const buf = this.toBuffer(v);
    const len = buf.length;
    if (typeof this.checks.min !== "undefined" && len < this.checks.min) {
      throw new MError(`Buffer is too short (min ${this.checks.min})`);
    }
    if (typeof this.checks.max !== "undefined" && len > this.checks.max) {
      throw new MError(`Buffer is too long (max ${this.checks.max})`);
    }

    if (v instanceof Binary) {
      if (v.sub_type !== this.checks.subType) {
        throw new MError(
          `Invalid Binary subtype: expected ${this.checks.subType}, got ${v.sub_type}`,
        );
      }
      return v as TA;
    }

    return new Binary(buf, this.checks.subType) as TA;
  }
}

// const M = {
//   binary: <T extends BinaryInput>() => new BinarySchema<T>(),
// };

// type InferSchemaType<MS extends MongsterSchemaBase<any>> = MS["$type"];

// const binData = M.binary();
// type TBin = InferSchemaType<typeof binData>; // =>
