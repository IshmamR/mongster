export interface MongsterIssue {
  path?: (string | number)[];
  message: string;
}

/**
 * Yes, it is the error class
 */
export class MongsTerror extends Error {
  issues: MongsterIssue[];

  constructor(issues: string, options?: ErrorOptions);
  constructor(issues: MongsterIssue | MongsterIssue[], message?: string, options?: ErrorOptions);

  constructor(
    issues: string | MongsterIssue | MongsterIssue[],
    arg2?: string | ErrorOptions,
    arg3?: ErrorOptions,
  ) {
    let normalizedIssues: MongsterIssue[];
    let message: string;
    let options: ErrorOptions | undefined;

    if (typeof issues === "string") {
      message = issues;
      normalizedIssues = [{ message: issues }];
      options = arg2 as ErrorOptions | undefined;
    } else {
      normalizedIssues = Array.isArray(issues) ? issues : [issues];
      message =
        typeof arg2 === "string" ? arg2 : (normalizedIssues[0]?.message ?? "MongsTerror occurred");
      options = (typeof arg2 === "string" ? arg3 : arg2) as ErrorOptions | undefined;
    }

    super(message, options);

    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "MongsTerror";

    this.issues = normalizedIssues;
  }
}

export { MongsTerror as MongsterError };
