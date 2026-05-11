/**
 * GWD home directory resolution.
 *
 * Exports gsdHome() which returns the GWD configuration directory,
 * defaulting to ~/.gwd with a GWD_HOME env var override.
 *
 * For the user's home directory, use os.homedir() directly — it handles
 * platform-specific env lookup (USERPROFILE on Windows, HOME on POSIX)
 * with appropriate fallbacks.
 *
 * @see https://github.com/gwd-build/gwd-2/issues/5015
 */
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Resolve the GWD home directory (typically ~/.gwd).
 *
 * `GWD_HOME` env var overrides the default location.
 * Falls back to `homedir()/.gwd`.
 *
 * Always returns an absolute, normalized path — `resolve()` canonicalizes
 * any relative or non-canonical `GWD_HOME` value so downstream comparison
 * and redaction sites don't have to.
 */
export function gsdHome(): string {
  return process.env.GWD_HOME
    ? resolve(process.env.GWD_HOME)
    : join(homedir(), ".gwd");
}
