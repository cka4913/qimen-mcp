/**
 * Business-logic errors travel in the tool *result*, not as MCP protocol errors.
 *
 * Two channels, deliberately separate:
 *   - malformed arguments  → -32602, raised by the zod schema before the handler
 *     runs. The SDK delivers this as an `isError` result whose text is a plain
 *     sentence, *not* JSON — so an error body is not always parseable.
 *   - valid arguments the engine cannot serve → `{ error: { code, message } }`,
 *     always parseable JSON.
 *
 * An agent should branch on `code`, never on message text, and should be ready
 * for an error body that does not parse (that one is a schema violation).
 */
import { KinqimenError } from "@kinqimen/core";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  /**
   * The same payload as data rather than text. Clients that understand
   * structured output read this and skip parsing; the text block stays for
   * those that don't, and for models reading the transcript directly.
   */
  structuredContent?: Record<string, unknown>;
  isError?: true;
};

/** Wrap a successful payload as MCP tool content, in both text and structured form. */
export function ok(payload: unknown): ToolResult {
  const result: ToolResult = { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    result.structuredContent = payload as Record<string, unknown>;
  }
  return result;
}

/** Turn a thrown error into a tool result carrying a machine-readable code. */
export function errorToToolResult(err: unknown): ToolResult {
  if (err instanceof KinqimenError) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: { code: err.code, message: err.message, details: err.details } }, null, 2),
        },
      ],
      isError: true,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text", text: JSON.stringify({ error: { code: "INTERNAL_ERROR", message } }, null, 2) }],
    isError: true,
  };
}

/** Run `fn`, converting any failure into an error tool result. */
export function safe(fn: () => unknown): ToolResult {
  try {
    return ok(fn());
  } catch (err) {
    return errorToToolResult(err);
  }
}
