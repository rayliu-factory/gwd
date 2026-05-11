/**
 * Shared GWD block-letter ASCII logo.
 *
 * Single source of truth — imported by:
 *   - scripts/postinstall.js (via dist/logo.js)
 *   - src/loader.ts (via ./logo.js)
 */

/** Raw logo lines — no ANSI codes, no leading newline. */
export const GWD_LOGO: readonly string[] = [
  '   ██████╗ ██╗    ██╗██████╗ ',
  '  ██╔════╝ ██║    ██║██╔══██╗',
  '  ██║  ███╗██║ █╗ ██║██║  ██║',
  '  ██║   ██║██║███╗██║██║  ██║',
  '  ╚██████╔╝╚███╔███╔╝██████╔╝',
  '   ╚═════╝  ╚══╝╚══╝ ╚═════╝ ',
]

/**
 * Render the logo block with a color function applied to each line.
 *
 * @param color — e.g. `(s) => `\x1b[36m${s}\x1b[0m`` or chalk.cyan
 * @returns Ready-to-write string with leading/trailing newlines.
 */
export function renderLogo(color: (s: string) => string): string {
  return '\n' + GWD_LOGO.map(color).join('\n') + '\n'
}
