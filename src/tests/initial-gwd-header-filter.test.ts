import test from "node:test";
import assert from "node:assert/strict";

const { filterInitialGwdHeader } = await import("../../web/lib/initial-gwd-header-filter.ts");
const { GWD_LOGO } = await import("../logo.ts");

test("filterInitialGwdHeader strips a plain startup banner and keeps real terminal content", () => {
  const warning = "Warning: Google Search is not configured.";
  const raw = [...GWD_LOGO, "  Get Work Done v2.33.1", "", warning].join("\n");

  const result = filterInitialGwdHeader(raw);

  assert.equal(result.status, "matched");
  assert.equal(result.text, warning);
});

test("filterInitialGwdHeader strips ANSI-colored startup banner output", () => {
  const cyan = "\u001b[36m";
  const reset = "\u001b[39m";
  const bold = "\u001b[1m";
  const boldReset = "\u001b[22m";
  const dim = "\u001b[2m";
  const dimReset = "\u001b[22m";
  const warning = "Warning: terminal content starts here.\r\n";

  const raw =
    GWD_LOGO.map((line) => `${cyan}${line}${reset}\r\n`).join("") +
    `  ${bold}Get Work Done${boldReset} ${dim}v2.33.1${dimReset}\r\n\r\n` +
    warning;

  const result = filterInitialGwdHeader(raw);

  assert.equal(result.status, "matched");
  assert.equal(result.text, warning);
});

test("filterInitialGwdHeader waits for more data when the startup banner is incomplete", () => {
  const partial = `${GWD_LOGO[0]}\n${GWD_LOGO[1]}\n${GWD_LOGO[2]}`;

  const result = filterInitialGwdHeader(partial);

  assert.deepEqual(result, { status: "needs-more", text: "" });
});

test("filterInitialGwdHeader passes normal terminal output through untouched", () => {
  const raw = "Warning: already in the shell\r\n$ ";

  const result = filterInitialGwdHeader(raw);

  assert.equal(result.status, "passthrough");
  assert.equal(result.text, raw);
});

test("filterInitialGwdHeader strips the loader renderLogo banner shape", () => {
  const cyan = "\u001b[36m";
  const reset = "\u001b[0m";
  const dim = "\u001b[2m";
  const terminal = "Warning: terminal content starts here.\n";
  const raw =
    "\n" +
    GWD_LOGO.map((line) => `${cyan}${line}${reset}`).join("\n") +
    "\n\n" +
    `  Get Work Done ${dim}v0.0.1${reset}\n` +
    terminal;

  const result = filterInitialGwdHeader(raw);

  assert.equal(result.status, "matched");
  assert.equal(result.text, terminal);
});
