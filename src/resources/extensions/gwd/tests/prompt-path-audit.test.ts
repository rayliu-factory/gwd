import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const promptsDir = join(__dirname, "..", "prompts");

test("prompt templates do not reference legacy milestone-root .gwd paths", () => {
  const offenders: string[] = [];
  for (const file of readdirSync(promptsDir)) {
    if (!file.endsWith(".md")) continue;
    const content = readFileSync(join(promptsDir, file), "utf-8");
    const legacyPatterns = [
      /\.gwd\/\{\{(?:milestoneId|mid)\}\}\//g,
      /\.gwd\/<milestone-id>\//g,
      /\.gwd\/<ID>\//g,
    ];
    for (const pattern of legacyPatterns) {
      if (pattern.test(content)) {
        offenders.push(`${file}: ${pattern.source}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "Milestone artifacts must use .gwd/milestones/<MID>/..., not legacy .gwd/<MID>/...",
  );
});

test("quick task prompt delegates commit policy to quick.ts", () => {
  const content = readFileSync(join(promptsDir, "quick-task.md"), "utf-8");
  assert.match(content, /\{\{commitInstruction\}\}/);
  assert.doesNotMatch(content, /Stage only relevant files/);
});
