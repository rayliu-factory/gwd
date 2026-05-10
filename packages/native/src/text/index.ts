/**
 * ANSI-aware text measurement and slicing.
 *
 * High-performance UTF-16 native implementation with ASCII fast-paths,
 * single-pass ANSI scanning, and proper Unicode grapheme cluster support.
 */

import { native } from "../native.js";
import { EllipsisKind, type ExtractSegmentsResult, type SliceResult } from "./types.js";

export type { ExtractSegmentsResult, SliceResult };
export { EllipsisKind } from "./types.js";

const ANSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function isNativeUnavailable(err: unknown): boolean {
  return err instanceof Error &&
    err.message.startsWith("Native function '") &&
    err.message.includes(" is not available on ");
}

function callNative<T>(name: string, args: unknown[], fallback: () => T): T {
  try {
    const fn = (native as Record<string, Function>)[name];
    if (typeof fn === "function") return fn(...args) as T;
  } catch (err) {
    if (!isNativeUnavailable(err)) throw err;
  }
  return fallback();
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

function normalizeTabWidth(tabWidth?: number): number {
  return Math.min(16, Math.max(1, Math.trunc(tabWidth ?? 3)));
}

function charWidth(segment: string, tabWidth?: number): number {
  if (segment === "\t") return normalizeTabWidth(tabWidth);
  const cp = segment.codePointAt(0);
  if (cp === undefined) return 0;
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6)
  ) return 2;
  return 1;
}

function visibleWidthFallback(text: string, tabWidth?: number): number {
  let width = 0;
  for (const { segment } of segmenter.segment(stripAnsi(text))) {
    width += charWidth(segment, tabWidth);
  }
  return width;
}

type Token = { text: string; width: number; ansi: boolean };

function tokenize(text: string, tabWidth?: number): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of text.matchAll(ANSI_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      for (const { segment } of segmenter.segment(text.slice(last, index))) {
        tokens.push({ text: segment, width: charWidth(segment, tabWidth), ansi: false });
      }
    }
    tokens.push({ text: match[0], width: 0, ansi: true });
    last = index + match[0].length;
  }
  if (last < text.length) {
    for (const { segment } of segmenter.segment(text.slice(last))) {
      tokens.push({ text: segment, width: charWidth(segment, tabWidth), ansi: false });
    }
  }
  return tokens;
}

function ellipsisFor(kind: number): string {
  if (kind === EllipsisKind.None) return "";
  if (kind === EllipsisKind.Ascii) return "...";
  return "\u2026";
}

function truncateToWidthFallback(
  text: string,
  maxWidth: number,
  ellipsisKind: number,
  pad: boolean,
  tabWidth?: number,
): string {
  const widthLimit = Math.max(0, Math.trunc(maxWidth));
  const currentWidth = visibleWidthFallback(text, tabWidth);
  if (currentWidth <= widthLimit) {
    return pad ? text + " ".repeat(widthLimit - currentWidth) : text;
  }

  const ellipsis = ellipsisFor(ellipsisKind);
  const ellipsisWidth = visibleWidthFallback(ellipsis, tabWidth);
  const contentLimit = Math.max(0, widthLimit - ellipsisWidth);
  let out = "";
  let used = 0;

  for (const token of tokenize(text, tabWidth)) {
    if (token.ansi) {
      out += token.text;
      continue;
    }
    if (used + token.width > contentLimit) break;
    out += token.text;
    used += token.width;
  }

  const result = out + (ellipsisWidth <= widthLimit ? ellipsis : "");
  const resultWidth = visibleWidthFallback(result, tabWidth);
  return pad ? result + " ".repeat(Math.max(0, widthLimit - resultWidth)) : result;
}

function wrapTextWithAnsiFallback(text: string, width: number, tabWidth?: number): string[] {
  const widthLimit = Math.max(1, Math.trunc(width));
  const wrapped: string[] = [];
  for (const line of text.split("\n")) {
    if (!ANSI_RE.test(line)) {
      wrapped.push(...wrapPlainLineFallback(line, widthLimit, tabWidth));
      continue;
    }
    ANSI_RE.lastIndex = 0;
    let current = "";
    let currentWidth = 0;
    for (const token of tokenize(line, tabWidth)) {
      if (token.ansi) {
        current += token.text;
        continue;
      }
      if (currentWidth > 0 && currentWidth + token.width > widthLimit) {
        wrapped.push(current);
        current = "";
        currentWidth = 0;
      }
      current += token.text;
      currentWidth += token.width;
    }
    wrapped.push(current);
  }
  return wrapped.length > 0 ? wrapped : [""];
}

function wrapPlainLineFallback(line: string, widthLimit: number, tabWidth?: number): string[] {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const wordWidth = visibleWidthFallback(word, tabWidth);
    if (wordWidth > widthLimit) {
      if (current) {
        lines.push(current);
        current = "";
      }
      let chunk = "";
      let chunkWidth = 0;
      for (const { segment } of segmenter.segment(word)) {
        const width = charWidth(segment, tabWidth);
        if (chunkWidth > 0 && chunkWidth + width > widthLimit) {
          lines.push(chunk);
          chunk = "";
          chunkWidth = 0;
        }
        chunk += segment;
        chunkWidth += width;
      }
      if (chunk) lines.push(chunk);
      continue;
    }

    if (!current) {
      current = word;
      continue;
    }

    const next = `${current} ${word}`;
    if (visibleWidthFallback(next, tabWidth) <= widthLimit) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function sliceWithWidthFallback(
  line: string,
  startCol: number,
  length: number,
  strict: boolean,
  tabWidth?: number,
): SliceResult {
  const start = Math.max(0, Math.trunc(startCol));
  const end = start + Math.max(0, Math.trunc(length));
  let col = 0;
  let text = "";
  let width = 0;

  for (const token of tokenize(line, tabWidth)) {
    if (token.ansi) {
      if (col >= start && col < end) text += token.text;
      continue;
    }
    const next = col + token.width;
    const overlaps = next > start && col < end;
    if (overlaps) {
      if (!strict || (col >= start && next <= end)) {
        text += token.text;
        width += token.width;
      }
    }
    col = next;
    if (col >= end) break;
  }

  return { text, width };
}

/**
 * Word-wrap text to a visible width, preserving ANSI escape codes across
 * line breaks.
 *
 * Active SGR codes (colors, bold, etc.) are carried to continuation lines.
 * Underline and strikethrough are reset at line ends and restored on the
 * next line.
 */
export function wrapTextWithAnsi(
  text: string,
  width: number,
  tabWidth?: number,
): string[] {
  return callNative("wrapTextWithAnsi", [text, width, tabWidth], () =>
    wrapTextWithAnsiFallback(text, width, tabWidth),
  );
}

/**
 * Truncate text to a visible width with an optional ellipsis.
 *
 * @param text       Input string (may contain ANSI codes).
 * @param maxWidth   Maximum visible width in terminal cells.
 * @param ellipsisKind  0 = "\u2026", 1 = "...", 2 = none.
 * @param pad        When true, pad with spaces to exactly `maxWidth`.
 * @param tabWidth   Tab stop width (default 3, range 1-16).
 */
export function truncateToWidth(
  text: string,
  maxWidth: number,
  ellipsisKind: number,
  pad: boolean,
  tabWidth?: number,
): string {
  return callNative("truncateToWidth", [text, maxWidth, ellipsisKind, pad, tabWidth], () =>
    truncateToWidthFallback(text, maxWidth, ellipsisKind, pad, tabWidth),
  );
}

/**
 * Slice a range of visible columns from a line.
 *
 * Counts terminal cells (skipping ANSI escapes). When `strict` is true,
 * wide characters that would exceed the range are excluded.
 */
export function sliceWithWidth(
  line: string,
  startCol: number,
  length: number,
  strict: boolean,
  tabWidth?: number,
): SliceResult {
  return callNative("sliceWithWidth", [line, startCol, length, strict, tabWidth], () =>
    sliceWithWidthFallback(line, startCol, length, strict, tabWidth),
  );
}

/**
 * Extract the before/after segments around an overlay region.
 *
 * ANSI state is tracked so the `after` segment renders correctly even when
 * the overlay truncates styled text.
 */
export function extractSegments(
  line: string,
  beforeEnd: number,
  afterStart: number,
  afterLen: number,
  strictAfter: boolean,
  tabWidth?: number,
): ExtractSegmentsResult {
  return callNative("extractSegments", [line, beforeEnd, afterStart, afterLen, strictAfter, tabWidth], () => {
    const before = sliceWithWidthFallback(line, 0, beforeEnd, false, tabWidth);
    const after = sliceWithWidthFallback(line, afterStart, afterLen, strictAfter, tabWidth);
    return {
      before: before.text,
      beforeWidth: before.width,
      after: after.text,
      afterWidth: after.width,
    };
  });
}

/**
 * Strip ANSI escape sequences, remove control characters and lone
 * surrogates, and normalize line endings (CR removed).
 *
 * Returns the original string when no changes are needed (zero-copy).
 */
export function sanitizeText(text: string): string {
  return callNative("sanitizeText", [text], () =>
    text
      .replace(/\r/g, "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, ""),
  );
}

/**
 * Calculate visible width of text excluding ANSI escape sequences.
 *
 * Tabs count as `tabWidth` cells (default 3).
 */
export function visibleWidth(text: string, tabWidth?: number): number {
  return callNative("visibleWidth", [text, tabWidth], () =>
    visibleWidthFallback(text, tabWidth),
  );
}
