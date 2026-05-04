export function must<T>(value: T | null | undefined, message = "Expected value"): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}
