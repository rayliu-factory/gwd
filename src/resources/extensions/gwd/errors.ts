/**
 * GWD Error Types — Typed error hierarchy for diagnostics and crash recovery.
 *
 * All GWD-specific errors extend GSDError, which carries a stable `code`
 * string suitable for programmatic matching. Error codes are defined as
 * constants so callers can switch on them without string-matching.
 */

// ─── Error Codes ──────────────────────────────────────────────────────────────

export const GWD_STALE_STATE = "GWD_STALE_STATE";
export const GWD_LOCK_HELD = "GWD_LOCK_HELD";
export const GWD_ARTIFACT_MISSING = "GWD_ARTIFACT_MISSING";
export const GWD_GIT_ERROR = "GWD_GIT_ERROR";
export const GWD_MERGE_CONFLICT = "GWD_MERGE_CONFLICT";
export const GWD_PARSE_ERROR = "GWD_PARSE_ERROR";
export const GWD_IO_ERROR = "GWD_IO_ERROR";

// ─── Base Error ───────────────────────────────────────────────────────────────

export class GSDError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GSDError";
    this.code = code;
  }
}
