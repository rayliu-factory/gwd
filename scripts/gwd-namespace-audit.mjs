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

const lowerOld = "g" + "sd";
const upperOld = "G" + "SD";
const pascalOld = "G" + "sd";
const phraseOld = ["Get", "Shit", "Done"].join(" ");

const activeOldNamespacePatterns = [
  new RegExp(`(^|[^A-Za-z0-9])${lowerOld}($|[^A-Za-z0-9])`),
  new RegExp(`${upperOld}_`),
  new RegExp(`\\.${lowerOld}`),
  new RegExp(`\\/${lowerOld}`),
  new RegExp(`${lowerOld}_`),
  new RegExp(`@${lowerOld}`),
  new RegExp(`${lowerOld}-pi`),
  new RegExp(`${lowerOld}-build`),
  new RegExp(`${lowerOld}-2`),
  new RegExp(`\\b${lowerOld}[A-Z]`),
  new RegExp(`${pascalOld}[A-Z]`),
  new RegExp(`\\b${upperOld}\\b`),
  new RegExp(phraseOld),
  /gwd-build\/gwd-2/,
  /github\.com\/gwd-build\/gwd-2/,
];

const historicalAllowlist = [
  /^\.plans\//,
  /^CHANGELOG\.md$/,
  /^docs\/dev\/superpowers\/plans\//,
  /^docs\/dev\/superpowers\/specs\//,
  /^docs\/dev\/superpowers\/specs\/2026-05-10-gwd-namespace-hard-cutover-design\.md$/,
  /^docs\/dev\/superpowers\/plans\/2026-05-10-gwd-namespace-hard-cutover\.md$/,
  /^docs\/dev\/superpowers\/specs\/2026-05-12-gwd-independent-initial-release-cutover-design\.md$/,
  /^docs\/dev\/superpowers\/plans\/2026-05-12-gwd-independent-initial-release-cutover\.md$/,
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
