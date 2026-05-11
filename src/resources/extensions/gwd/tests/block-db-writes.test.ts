/**
 * Regression test for #3674 — block direct writes to gwd.db
 *
 * When gsd_complete_task was unavailable, agents fell back to shell-based
 * sqlite3 writes, corrupting the WAL-backed database. The fix extends
 * write-intercept to block file writes and bash commands targeting gwd.db.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedStateFile, isBashWriteToStateFile } from '../write-intercept.ts';

describe('isBlockedStateFile blocks gwd.db paths (#3674)', () => {
  test('blocks .gwd/gwd.db', () => {
    assert.ok(isBlockedStateFile('/project/.gwd/gwd.db'));
  });

  test('blocks .gwd/gwd.db-wal', () => {
    assert.ok(isBlockedStateFile('/project/.gwd/gwd.db-wal'));
  });

  test('blocks .gwd/gwd.db-shm', () => {
    assert.ok(isBlockedStateFile('/project/.gwd/gwd.db-shm'));
  });

  test('blocks resolved symlink path under .gwd/projects/', () => {
    assert.ok(isBlockedStateFile('/home/user/.gwd/projects/myproj/gwd.db'));
  });

  test('still blocks STATE.md', () => {
    assert.ok(isBlockedStateFile('/project/.gwd/STATE.md'));
  });

  test('does not block other .gwd files', () => {
    assert.ok(!isBlockedStateFile('/project/.gwd/DECISIONS.md'));
  });
});

describe('isBashWriteToStateFile blocks DB shell commands (#3674)', () => {
  test('blocks sqlite3 targeting gwd.db', () => {
    assert.ok(isBashWriteToStateFile('sqlite3 .gwd/gwd.db "INSERT INTO ..."'));
  });

  test('blocks better-sqlite3 targeting gwd.db', () => {
    assert.ok(isBashWriteToStateFile('node -e "require(\'better-sqlite3\')(\'.gwd/gwd.db\')"'));
  });

  test('blocks shell redirect to gwd.db', () => {
    assert.ok(isBashWriteToStateFile('echo data > .gwd/gwd.db'));
  });

  test('blocks cp to gwd.db', () => {
    assert.ok(isBashWriteToStateFile('cp backup.db .gwd/gwd.db'));
  });

  test('blocks mv to gwd.db', () => {
    assert.ok(isBashWriteToStateFile('mv temp.db .gwd/gwd.db'));
  });

  test('does not block reading gwd.db with cat', () => {
    assert.ok(!isBashWriteToStateFile('cat .gwd/gwd.db'));
  });
});
