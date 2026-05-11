/**
 * Regression test for #3674 — block direct writes to gsd.db
 *
 * When gsd_complete_task was unavailable, agents fell back to shell-based
 * sqlite3 writes, corrupting the WAL-backed database. The fix extends
 * write-intercept to block file writes and bash commands targeting gsd.db.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedStateFile, isBashWriteToStateFile } from '../write-intercept.ts';

describe('isBlockedStateFile blocks gsd.db paths (#3674)', () => {
  test('blocks .gsd/gwd.db', () => {
    assert.ok(isBlockedStateFile('/project/.gsd/gwd.db'));
  });

  test('blocks .gsd/gwd.db-wal', () => {
    assert.ok(isBlockedStateFile('/project/.gsd/gwd.db-wal'));
  });

  test('blocks .gsd/gwd.db-shm', () => {
    assert.ok(isBlockedStateFile('/project/.gsd/gwd.db-shm'));
  });

  test('blocks resolved symlink path under .gwd/projects/', () => {
    assert.ok(isBlockedStateFile('/home/user/.gwd/projects/myproj/gwd.db'));
  });

  test('still blocks STATE.md', () => {
    assert.ok(isBlockedStateFile('/project/.gsd/STATE.md'));
  });

  test('does not block other .gsd files', () => {
    assert.ok(!isBlockedStateFile('/project/.gsd/DECISIONS.md'));
  });
});

describe('isBashWriteToStateFile blocks DB shell commands (#3674)', () => {
  test('blocks sqlite3 targeting gsd.db', () => {
    assert.ok(isBashWriteToStateFile('sqlite3 .gsd/gwd.db "INSERT INTO ..."'));
  });

  test('blocks better-sqlite3 targeting gsd.db', () => {
    assert.ok(isBashWriteToStateFile('node -e "require(\'better-sqlite3\')(\'.gsd/gwd.db\')"'));
  });

  test('blocks shell redirect to gsd.db', () => {
    assert.ok(isBashWriteToStateFile('echo data > .gsd/gwd.db'));
  });

  test('blocks cp to gsd.db', () => {
    assert.ok(isBashWriteToStateFile('cp backup.db .gsd/gwd.db'));
  });

  test('blocks mv to gsd.db', () => {
    assert.ok(isBashWriteToStateFile('mv temp.db .gsd/gwd.db'));
  });

  test('does not block reading gsd.db with cat', () => {
    assert.ok(!isBashWriteToStateFile('cat .gsd/gwd.db'));
  });
});
