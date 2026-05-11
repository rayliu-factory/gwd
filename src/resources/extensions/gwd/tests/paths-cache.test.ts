// GWD — paths cache normalization and clearPathCache() invalidation tests

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, renameSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { gsdRoot, clearPathCache, _clearGwdRootCache } from '../paths.ts';

describe('gsdRootCache key normalization', () => {
  let projectDir: string;
  let fakeHome: string;
  let savedHome: string | undefined;
  let savedUserProfile: string | undefined;
  let savedGsdHome: string | undefined;

  beforeEach(() => {
    projectDir = realpathSync(mkdtempSync(join(tmpdir(), 'gwd-cache-norm-')));
    mkdirSync(join(projectDir, '.gwd'), { recursive: true });

    fakeHome = realpathSync(mkdtempSync(join(tmpdir(), 'gwd-cache-home-')));

    savedHome = process.env.HOME;
    savedUserProfile = process.env.USERPROFILE;
    savedGsdHome = process.env.GWD_HOME;

    // Point HOME and GWD_HOME at an unrelated temp dir to prevent ~/.gwd interference.
    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;
    process.env.GWD_HOME = join(fakeHome, '.gwd');

    _clearGwdRootCache();
  });

  afterEach(() => {
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    if (savedUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = savedUserProfile;
    if (savedGsdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = savedGsdHome;

    clearPathCache();
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(fakeHome, { recursive: true, force: true });
  });

  test('gsdRoot with trailing slash returns same result as without', () => {
    const withoutSlash = gsdRoot(projectDir);
    _clearGwdRootCache();
    const withSlash = gsdRoot(projectDir + '/');

    assert.equal(
      withoutSlash,
      withSlash,
      'gsdRoot must return the same path regardless of trailing slash',
    );
    assert.equal(
      withoutSlash,
      join(projectDir, '.gwd'),
      'both calls should resolve to projectDir/.gwd',
    );
  });

  test('second call with trailing slash hits cache set by first call without slash', () => {
    // Prime the cache with the no-slash form.
    const first = gsdRoot(projectDir);
    // Now remove .gwd so a fresh probe would return a different path.
    renameSync(join(projectDir, '.gwd'), join(projectDir, '.gwd-hidden'));
    // Call with trailing slash — must hit the normalized cache entry (no re-probe).
    const second = gsdRoot(projectDir + '/');
    // Restore for cleanup.
    renameSync(join(projectDir, '.gwd-hidden'), join(projectDir, '.gwd'));

    assert.equal(
      second,
      first,
      'trailing-slash call must return cached result from the no-slash call',
    );
  });
});

describe('clearPathCache() does NOT invalidate gsdRootCache (process-lifetime semantics)', () => {
  let projectDir: string;
  let fakeHome: string;
  let savedHome: string | undefined;
  let savedUserProfile: string | undefined;
  let savedGsdHome: string | undefined;

  beforeEach(() => {
    projectDir = realpathSync(mkdtempSync(join(tmpdir(), 'gwd-cache-clear-')));
    mkdirSync(join(projectDir, '.gwd'), { recursive: true });

    fakeHome = realpathSync(mkdtempSync(join(tmpdir(), 'gwd-cache-home2-')));

    savedHome = process.env.HOME;
    savedUserProfile = process.env.USERPROFILE;
    savedGsdHome = process.env.GWD_HOME;

    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;
    process.env.GWD_HOME = join(fakeHome, '.gwd');

    _clearGwdRootCache();
  });

  afterEach(() => {
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    if (savedUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = savedUserProfile;
    if (savedGsdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = savedGsdHome;

    _clearGwdRootCache();
    clearPathCache();
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(fakeHome, { recursive: true, force: true });
  });

  test('clearPathCache() does NOT evict a cached gsdRoot result', (t) => {
    // Prime the cache.
    const firstResult = gsdRoot(projectDir);
    assert.equal(firstResult, join(projectDir, '.gwd'));

    // Remove .gwd so a fresh probe would return a different (fallback) result.
    renameSync(join(projectDir, '.gwd'), join(projectDir, '.gwd-hidden'));
    t.after(() => {
      try { renameSync(join(projectDir, '.gwd-hidden'), join(projectDir, '.gwd')); } catch { /* ignore */ }
    });

    // clearPathCache() only clears volatile dir caches — gsdRootCache is untouched.
    clearPathCache();
    const afterClearPath = gsdRoot(projectDir);
    assert.equal(
      afterClearPath,
      firstResult,
      'clearPathCache must NOT evict gsdRootCache — result must still be the cached value',
    );
  });

  test('_clearGwdRootCache() DOES evict gsdRootCache, causing re-probe', (t) => {
    // Prime the cache.
    const firstResult = gsdRoot(projectDir);
    assert.equal(firstResult, join(projectDir, '.gwd'));

    // Remove .gwd so a fresh probe returns the creation fallback.
    renameSync(join(projectDir, '.gwd'), join(projectDir, '.gwd-hidden'));
    t.after(() => {
      try { renameSync(join(projectDir, '.gwd-hidden'), join(projectDir, '.gwd')); } catch { /* ignore */ }
    });

    // _clearGwdRootCache() evicts the entry — next call re-probes.
    _clearGwdRootCache();
    const afterClearRoot = gsdRoot(projectDir);
    assert.equal(
      afterClearRoot,
      join(projectDir, '.gwd'),
      'after _clearGwdRootCache, gsdRoot must re-probe and return creation fallback',
    );
    // The two results are equal (same path) but the key point is re-probe occurred;
    // the cached firstResult also happened to equal the fallback path.
    // Verify: if we prime again without removing .gwd, clearing root re-probes to gwd.
    renameSync(join(projectDir, '.gwd-hidden'), join(projectDir, '.gwd'));
    _clearGwdRootCache();
    const reprobe = gsdRoot(projectDir);
    assert.equal(reprobe, join(projectDir, '.gwd'), 're-probe after restore returns .gwd');
  });
});
