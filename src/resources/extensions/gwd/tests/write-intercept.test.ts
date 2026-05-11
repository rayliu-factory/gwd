// GWD Extension — write-intercept unit tests
// Tests isBlockedStateFile() and BLOCKED_WRITE_ERROR constant.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedStateFile, BLOCKED_WRITE_ERROR } from '../write-intercept.ts';

// ─── isBlockedStateFile: blocked paths ───────────────────────────────────

test('write-intercept: blocks unix .gwd/STATE.md path', () => {
  assert.strictEqual(isBlockedStateFile('/project/.gwd/STATE.md'), true);
});

test('write-intercept: blocks relative path with dir prefix before .gwd/STATE.md', () => {
  assert.strictEqual(isBlockedStateFile('project/.gwd/STATE.md'), true);
});

test('write-intercept: blocks bare relative .gwd/STATE.md (no leading separator)', () => {
  // (^|[/\\]) matches paths that start with .gwd/ — covers the case where write
  // tools receive a bare relative path before the file exists (realpathSync fails).
  assert.strictEqual(isBlockedStateFile('.gwd/STATE.md'), true);
});

test('write-intercept: blocks nested project .gwd/STATE.md path', () => {
  assert.strictEqual(isBlockedStateFile('/Users/dev/my-project/.gwd/STATE.md'), true);
});

test('write-intercept: blocks .gwd/projects/<name>/STATE.md (symlinked projects path)', () => {
  assert.strictEqual(isBlockedStateFile('/home/user/.gwd/projects/my-project/STATE.md'), true);
});

// ─── isBlockedStateFile: allowed paths ───────────────────────────────────

test('write-intercept: allows .gwd/ROADMAP.md', () => {
  assert.strictEqual(isBlockedStateFile('/project/.gwd/ROADMAP.md'), false);
});

test('write-intercept: allows .gwd/PLAN.md', () => {
  assert.strictEqual(isBlockedStateFile('/project/.gwd/PLAN.md'), false);
});

test('write-intercept: allows .gwd/REQUIREMENTS.md', () => {
  assert.strictEqual(isBlockedStateFile('/project/.gwd/REQUIREMENTS.md'), false);
});

test('write-intercept: allows .gwd/SUMMARY.md', () => {
  assert.strictEqual(isBlockedStateFile('/project/.gwd/SUMMARY.md'), false);
});

test('write-intercept: allows .gwd/PROJECT.md', () => {
  assert.strictEqual(isBlockedStateFile('/project/.gwd/PROJECT.md'), false);
});

test('write-intercept: allows regular source files', () => {
  assert.strictEqual(isBlockedStateFile('/project/src/index.ts'), false);
});

test('write-intercept: allows slice plan files', () => {
  assert.strictEqual(isBlockedStateFile('/project/.gwd/milestones/M001/slices/S01/S01-PLAN.md'), false);
});

test('write-intercept: does not block files named STATE.md outside .gwd/', () => {
  assert.strictEqual(isBlockedStateFile('/project/docs/STATE.md'), false);
});

// ─── BLOCKED_WRITE_ERROR: content ────────────────────────────────────────

test('write-intercept: BLOCKED_WRITE_ERROR is a non-empty string', () => {
  assert.strictEqual(typeof BLOCKED_WRITE_ERROR, 'string');
  assert.ok(BLOCKED_WRITE_ERROR.length > 0);
});

test('write-intercept: BLOCKED_WRITE_ERROR mentions engine tool calls', () => {
  assert.ok(BLOCKED_WRITE_ERROR.includes('gsd_task_complete'), 'should mention gsd_task_complete');
  assert.ok(BLOCKED_WRITE_ERROR.includes('engine tool calls'), 'should mention engine tool calls');
});
