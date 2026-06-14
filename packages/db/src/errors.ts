/** Stable, machine-readable error codes thrown by the economy helpers. */
export type ErrorCode =
  | "INSUFFICIENT_FUNDS"
  | "INSUFFICIENT_ITEMS"
  | "CHARACTER_NOT_FOUND"
  | "ITEM_NOT_FOUND"
  | "PLOT_NOT_FOUND"
  | "PLOT_TAKEN"
  | "ALREADY_OWN_PLOT"
  | "NOT_PLOT_OWNER"
  // structures (P7 free-form building)
  | "NO_PLOT"
  | "OUT_OF_BOUNDS"
  | "OVERLAP"
  | "STRUCTURE_NOT_FOUND"
  | "STRUCTURE_MAX_TIER"
  | "STRUCTURE_STALE";

/** An error carrying a typed `code` so callers can branch without string matching. */
export class TypedError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "TypedError";
  }
}
