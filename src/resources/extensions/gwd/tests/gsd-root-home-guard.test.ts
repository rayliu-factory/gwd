/**
 * GWD2 — regression tests for #5187 and git-root anchor guard:
 *
 * #5187: gsdRoot() must refuse to use the global GWD home (~/.gwd) as a
 * project .gwd directory when basePath resolves to $HOME. Paths under
 * ~/.gwd/projects/<hash>/ remain valid.
 *
 * git-root anchor guard: when $HOME is itself a git repo and ~/.gwd exists,
 * gsdRoot() must NOT return ~/.gwd for a subdir basePath like ~/projects/foo.
 * It should fall through to step 4 (creation fallback) instead.
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { gsdRoot, _clearGwdRootCache } from '../paths.ts';

describe('gsdRoot() refuses ~/.gwd as project state when basePath is $HOME (#5187)', () => {
  let fakeHome: string;
  let savedHome: string | undefined;
  let savedUserProfile: string | undefined;
  let savedGwdHome: string | undefined;

  beforeEach(() => {
    fakeHome = realpathSync(mkdtempSync(join(tmpdir(), 'gwd-home-guard-')));
    mkdirSync(join(fakeHome, '.gwd'), { recursive: true });

    savedHome = process.env.HOME;
    savedUserProfile = process.env.USERPROFILE;
    savedGwdHome = process.env.GWD_HOME;

    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;
    delete process.env.GWD_HOME;

    _clearGwdRootCache();
  });

  afterEach(() => {
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    if (savedUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = savedUserProfile;
    if (savedGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = savedGwdHome;

    _clearGwdRootCache();
    rmSync(fakeHome, { recursive: true, force: true });
  });

  test('does not use the global GWD home when basePath is the home directory', () => {
    assert.equal(gsdRoot(fakeHome), join(fakeHome, '.gwd'));
  });

  test('does NOT throw for paths under ~/.gwd/projects/<hash>/', () => {
    const projectStateDir = join(fakeHome, '.gwd', 'projects', 'abcdef123456');
    mkdirSync(join(projectStateDir, '.gwd'), { recursive: true });
    _clearGwdRootCache();

    const resolved = gsdRoot(projectStateDir);
    assert.equal(resolved, join(projectStateDir, '.gwd'));
  });

  test('does NOT throw for an unrelated project directory that has its own .gwd', () => {
    const projectDir = realpathSync(mkdtempSync(join(tmpdir(), 'gwd-home-guard-proj-')));
    mkdirSync(join(projectDir, '.gwd'), { recursive: true });
    _clearGwdRootCache();
    try {
      const resolved = gsdRoot(projectDir);
      assert.equal(resolved, join(projectDir, '.gwd'));
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

describe('git-root anchor guard: subdir basePath must not resolve to ~/.gwd', () => {
  let fakeHome: string;
  let subDir: string;
  let savedHome: string | undefined;
  let savedUserProfile: string | undefined;
  let savedGwdHome: string | undefined;

  beforeEach(() => {
    // Create a tmpdir that will act as both $HOME and a git repo root.
    fakeHome = realpathSync(mkdtempSync(join(tmpdir(), 'gwd-anchor-guard-')));
    // Init a bare-minimum git repo so git rev-parse --show-toplevel returns fakeHome.
    spawnSync('git', ['init', fakeHome], { encoding: 'utf-8' });
    // Create ~/.gwd (the global home that must NOT be used for project subdirs).
    mkdirSync(join(fakeHome, '.gwd'), { recursive: true });
    // Create a subdir inside the git repo — this is the project basePath.
    subDir = join(fakeHome, 'projects', 'foo');
    mkdirSync(subDir, { recursive: true });

    savedHome = process.env.HOME;
    savedUserProfile = process.env.USERPROFILE;
    savedGwdHome = process.env.GWD_HOME;

    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;
    delete process.env.GWD_HOME;

    _clearGwdRootCache();
  });

  afterEach(() => {
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    if (savedUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = savedUserProfile;
    if (savedGwdHome === undefined) delete process.env.GWD_HOME;
    else process.env.GWD_HOME = savedGwdHome;

    _clearGwdRootCache();
    rmSync(fakeHome, { recursive: true, force: true });
  });

  test('does NOT return ~/.gwd when $HOME is a git repo and basePath is a subdir', () => {
    // fakeHome IS the git root AND $HOME, so git rev-parse returns fakeHome,
    // and ~/.gwd (fakeHome/.gwd) exists. The guard must skip that candidate
    // and fall through to the creation fallback: subDir/.gwd.
    const result = gsdRoot(subDir);
    assert.notEqual(
      result,
      join(fakeHome, '.gwd'),
      'gsdRoot must not return ~/.gwd for a subdir basePath',
    );
    assert.equal(
      result,
      join(subDir, '.gwd'),
      'gsdRoot should fall through to the creation fallback for a subdir',
    );
  });
});
