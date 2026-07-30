/**
 * Every failure the engine raises on its own carries a machine-readable code.
 * The MCP layer turns these into `{ error: { code, message } }` tool results;
 * an agent branches on `code`, never on message text.
 */
export type QimenErrorCode =
  | "DATETIME_INVALID"
  | "ARGUMENT_REQUIRED"
  | "TIMEZONE_INVALID"
  | "DATETIME_OUT_OF_RANGE"
  | "JIEQI_NOT_FOUND"
  | "ANGAN_NOT_FOUND"
  | "UNKNOWN_REFERENCE_KEY"
  | "TABLE_LOOKUP_FAILED";

export class QimenError extends Error {
  readonly code: QimenErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: QimenErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "QimenError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** Table lookups that the upstream engine assumes always hit. Fail loudly instead of returning undefined. */
export function must<T>(value: T | undefined | null, what: string, details?: Record<string, unknown>): T {
  if (value === undefined || value === null) {
    throw new QimenError("TABLE_LOOKUP_FAILED", `${what} not found`, details);
  }
  return value;
}
