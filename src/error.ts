export interface MongsterIssue {
  path?: (string | number)[];
  message: string;
}

const MONGSTER_ERROR_CODE = {
  SCHEMA: "schema_error",
  VALIDATION: "validation_error",
  QUERY: "query_error",
  CONNECTION: "connection_error",
  TRANSACTION: "transaction_error",
  INDEX_SYNC: "index_sync_error",
} as const;
const mongsterErrorCodes = Object.values(MONGSTER_ERROR_CODE);
export type MongsterErrorCode = (typeof mongsterErrorCodes)[number];

/**
 * base error class for all Mongster errors
 */
export class MongsterError extends Error {
  /**
   * to toggle stack trace capture for all `MongsterError` instances.
   * ```ts
   * MongsterError.stackTraces = false; // disable (e.g. on production for a little less overhead)
   * MongsterError.stackTraces = true;  // enable  (default)
   * ```
   */
  static stackTraces = true;

  readonly code: MongsterErrorCode;
  readonly issues: MongsterIssue[];

  // Overloads
  constructor(code: MongsterErrorCode, message: string, options?: ErrorOptions);
  constructor(code: MongsterErrorCode, issue: MongsterIssue, options?: ErrorOptions);
  constructor(
    code: MongsterErrorCode,
    issue: MongsterIssue,
    message?: string,
    options?: ErrorOptions,
  );
  constructor(code: MongsterErrorCode, issues: MongsterIssue[], options?: ErrorOptions);
  constructor(
    code: MongsterErrorCode,
    issues: MongsterIssue[],
    message?: string,
    options?: ErrorOptions,
  );
  // Implementation
  constructor(
    code: MongsterErrorCode,
    msgOrIssueOrIssues: string | MongsterIssue | MongsterIssue[],
    maybeMsgOrOpts?: string | ErrorOptions,
    maybeOpts?: ErrorOptions,
  ) {
    let normalizedIssues: MongsterIssue[];
    let message: string;
    let options: ErrorOptions | undefined;

    if (typeof msgOrIssueOrIssues === "string") {
      // signature: (code, message, options?)
      message = msgOrIssueOrIssues;
      normalizedIssues = [{ message }];
      if (typeof maybeMsgOrOpts !== "string") options = maybeMsgOrOpts;
    } else {
      // signature: (code, issue | issues, [message? | options?], [options?])
      normalizedIssues = Array.isArray(msgOrIssueOrIssues)
        ? msgOrIssueOrIssues
        : [msgOrIssueOrIssues];

      message =
        typeof maybeMsgOrOpts === "string"
          ? maybeMsgOrOpts
          : (normalizedIssues[0]?.message ?? "Mongster error");

      options = typeof maybeMsgOrOpts === "string" ? maybeOpts : maybeMsgOrOpts;
    }

    super(message, options);

    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    this.code = code;
    this.issues = normalizedIssues;

    if (!MongsterError.stackTraces) {
      this.stack = `${this.name}: ${this.message}`;
    }
  }
}

// -- -- -- -- -- -- -- -- --
// - Specialized subclasses -
// -- -- -- -- -- -- -- -- --

/**
 * thrown during schema `parse` / `parseForUpdate` when a value
 * fails type or constraint checks
 */
export class SchemaError extends MongsterError {
  constructor(message: string, options?: ErrorOptions) {
    super(MONGSTER_ERROR_CODE.SCHEMA, message, options);
  }
}

/**
 * thrown when an update-operator object violates structural or schema-level rules
 *
 * (e.g.: `$inc` on a non-number field)
 */
export class ValidationError extends MongsterError {
  constructor(message: string, options?: ErrorOptions) {
    super(MONGSTER_ERROR_CODE.VALIDATION, message, options);
  }
}

/**
 * thrown when a collection method receives invalid arguments
 * (wrong filter type, empty array, etc.)
 */
export class QueryError extends MongsterError {
  constructor(message: string, options?: ErrorOptions) {
    super(MONGSTER_ERROR_CODE.QUERY, message, options);
  }
}

/**
 * thrown when the client cannot connect to (or loses connection with)
 * the MongoDB server
 */
export class ConnectionError extends MongsterError {
  constructor(message: string, options?: ErrorOptions) {
    super(MONGSTER_ERROR_CODE.CONNECTION, message, options);
  }
}

/**
 * thrown when a transaction callback fails or when session
 * management encounters an error
 */
export class TransactionError extends MongsterError {
  constructor(message: string, options?: ErrorOptions) {
    super(MONGSTER_ERROR_CODE.TRANSACTION, message, options);
  }
}

/**
 * thrown when automatic index synchronization fails
 */
export class IndexSyncError extends MongsterError {
  constructor(message: string, options?: ErrorOptions) {
    super(MONGSTER_ERROR_CODE.INDEX_SYNC, message, options);
  }
}
