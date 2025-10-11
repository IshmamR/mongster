export interface MIssue {
  path?: (string | number)[];
  message: string;
}

/**
 * Yes, it is the error class
 */
export class MError extends Error {
  issues: MIssue[];

  constructor(issues: string, options?: ErrorOptions);
  constructor(issues: MIssue | MIssue[], message?: string, options?: ErrorOptions);

  constructor(
    issues: string | MIssue | MIssue[],
    arg2?: string | ErrorOptions,
    arg3?: ErrorOptions,
  ) {
    let normalizedIssues: MIssue[];
    let message: string;
    let options: ErrorOptions | undefined;

    if (typeof issues === "string") {
      message = issues;
      normalizedIssues = [{ message: issues }];
      options = arg2 as ErrorOptions | undefined;
    } else {
      normalizedIssues = Array.isArray(issues) ? issues : [issues];
      message =
        typeof arg2 === "string" ? arg2 : (normalizedIssues[0]?.message ?? "MError occurred");
      options = (typeof arg2 === "string" ? arg3 : arg2) as ErrorOptions | undefined;
    }

    super(message, options);

    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "MError";

    this.issues = normalizedIssues;
  }
}

export { MError as MongsterError };
