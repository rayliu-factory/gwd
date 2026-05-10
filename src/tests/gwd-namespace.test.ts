import test from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  CLI_COMMAND,
  ENV_PREFIX,
  GLOBAL_STATE_DIR_NAME,
  GWD_BIN_PATH_ENV,
  GWD_HEADLESS_ENV,
  GWD_HOME_ENV,
  GWD_RTK_DISABLED_ENV,
  GWD_RTK_PATH_ENV,
  GWD_SKIP_RTK_INSTALL_ENV,
  GWD_VERSION_ENV,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_FULL_NAME,
  PRODUCT_PACKAGE_NAME,
  PRODUCT_SHORT_NAME,
  PROJECT_STATE_DIR_NAME,
  RUNTIME_DB_FILE_NAME,
  SLASH_COMMAND_PREFIX,
  TOOL_PREFIX,
} from "../namespace.ts";

async function importAppPaths() {
  return import(`../app-paths.ts?cache=${Date.now()}-${Math.random()}`);
}

async function withEnv<T>(
  patch: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const original = new Map<string, string | undefined>();
  for (const key of Object.keys(patch)) {
    original.set(key, process.env[key]);
    const value = patch[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("namespace constants use GWD hard-cutover values", () => {
  assert.equal(PRODUCT_SHORT_NAME, "gwd");
  assert.equal(PRODUCT_DISPLAY_NAME, "GWD");
  assert.equal(PRODUCT_FULL_NAME, "Get Work Done");
  assert.equal(PRODUCT_PACKAGE_NAME, "gwd-pi");
  assert.equal(GLOBAL_STATE_DIR_NAME, ".gwd");
  assert.equal(PROJECT_STATE_DIR_NAME, ".gwd");
  assert.equal(RUNTIME_DB_FILE_NAME, "gwd.db");
  assert.equal(ENV_PREFIX, "GWD");
  assert.equal(CLI_COMMAND, "gwd");
  assert.equal(SLASH_COMMAND_PREFIX, "/gwd");
  assert.equal(TOOL_PREFIX, "gwd_");
  assert.equal(GWD_HOME_ENV, "GWD_HOME");
  assert.equal(GWD_BIN_PATH_ENV, "GWD_BIN_PATH");
  assert.equal(GWD_VERSION_ENV, "GWD_VERSION");
  assert.equal(GWD_HEADLESS_ENV, "GWD_HEADLESS");
  assert.equal(GWD_RTK_DISABLED_ENV, "GWD_RTK_DISABLED");
  assert.equal(GWD_RTK_PATH_ENV, "GWD_RTK_PATH");
  assert.equal(GWD_SKIP_RTK_INSTALL_ENV, "GWD_SKIP_RTK_INSTALL");
});

test("app paths honor GWD_HOME and ignore GSD_HOME", async () => {
  await withEnv(
    {
      GWD_HOME: "/tmp/gwd-home",
      GSD_HOME: "/tmp/legacy-gsd-home",
    },
    async () => {
      const paths = await importAppPaths();
      assert.equal(paths.appRoot, "/tmp/gwd-home");
      assert.equal(paths.agentDir, "/tmp/gwd-home/agent");
      assert.equal(paths.sessionsDir, "/tmp/gwd-home/sessions");
      assert.equal(paths.authFilePath, "/tmp/gwd-home/agent/auth.json");
      assert.equal(paths.webPidFilePath, "/tmp/gwd-home/web-server.pid");
      assert.equal(paths.webPreferencesPath, "/tmp/gwd-home/web-preferences.json");
    },
  );
});

test("default app path uses ~/.gwd even if GSD_HOME is set", async () => {
  await withEnv(
    {
      GWD_HOME: undefined,
      GSD_HOME: "/tmp/legacy-gsd-home",
    },
    async () => {
      const defaultRoot = join(homedir(), ".gwd");
      const paths = await importAppPaths();
      assert.equal(paths.appRoot, defaultRoot);
      assert.equal(paths.agentDir, join(defaultRoot, "agent"));
      assert.equal(paths.sessionsDir, join(defaultRoot, "sessions"));
      assert.equal(paths.authFilePath, join(defaultRoot, "agent", "auth.json"));
      assert.equal(paths.webPidFilePath, join(defaultRoot, "web-server.pid"));
      assert.equal(paths.webPreferencesPath, join(defaultRoot, "web-preferences.json"));
    },
  );
});
