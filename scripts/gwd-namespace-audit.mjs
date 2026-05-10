// scripts/gwd-namespace-audit.mjs
// Fails on active old GSD namespace references after the hard cutover.

import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

const ignoredDirs = new Set([
  ".git",
  ".worktrees",
  "node_modules",
  "dist",
  "dist-test",
  ".next",
  "coverage",
  ".turbo",
  ".cache",
]);

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".dockerignore",
  ".gitignore",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".ps1",
  ".rs",
  ".sh",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

const activeOldNamespacePatterns = [
  /(^|[^A-Za-z0-9])gsd($|[^A-Za-z0-9])/,
  /GSD_/,
  /\.gsd/,
  /\/gsd/,
  /@gsd/,
  /gsd-pi/,
  /gsd-build/,
  /gsd-2/,
  /\bgsd[A-Z]/,
  /Gsd[A-Z]/,
  /\bGSD\b/,
  /Get Shit Done/,
];

const historicalAllowlist = [
  /^CHANGELOG\.md$/,
  /^docs\/dev\/superpowers\/specs\/2026-05-10-gwd-namespace-hard-cutover-design\.md$/,
  /^docs\/dev\/superpowers\/plans\/2026-05-10-gwd-namespace-hard-cutover\.md$/,
  /^docs\/dev\/superpowers\/specs\/2026-03-17-cicd-pipeline-design\.md$/,
  /^docs\/dev\/superpowers\/plans\/2026-03-17-cicd-pipeline\.md$/,
];

function isTextFile(path) {
  return textExtensions.has(path.slice(path.lastIndexOf("."))) || path.endsWith("Dockerfile") || path.includes("/Dockerfile");
}

function isAllowlisted(path) {
  return historicalAllowlist.some((pattern) => pattern.test(path));
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const rel = relative(root, abs).replaceAll("\\", "/");
    const stat = lstatSync(abs);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      if (!ignoredDirs.has(entry)) yield* walk(abs);
      continue;
    }
    if (stat.isFile() && isTextFile(rel)) yield rel;
  }
}

const failures = [];

for (const rel of walk(root)) {
  if (isAllowlisted(rel)) continue;
  const content = readFileSync(join(root, rel), "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of activeOldNamespacePatterns) {
      if (pattern.test(line)) {
        failures.push(`${rel}:${index + 1}: ${line.trim()}`);
        break;
      }
    }
  });
}

if (failures.length > 0) {
  process.stderr.write(`Old active namespace references found (${failures.length}):\n`);
  process.stderr.write(failures.slice(0, 200).join("\n"));
  if (failures.length > 200) {
    process.stderr.write(`\n...and ${failures.length - 200} more`);
  }
  process.stderr.write("\n");
  process.exit(1);
}

process.stdout.write("GWD namespace audit passed\n");
