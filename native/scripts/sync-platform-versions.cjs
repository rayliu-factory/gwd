#!/usr/bin/env node

/**
 * Synchronize platform package versions with the root package version.
 *
 * Reads version from root package.json, writes it to all platform
 * package.json files and updates optionalDependencies in root package.json.
 */

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..");
const npmDir = path.resolve(__dirname, "..", "npm");

const rootPkgPath = path.join(rootDir, "package.json");
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
const version = rootPkg.version;

console.log(`[sync-platform-versions] Syncing to version ${version}`);

const platformPackages = [
  "darwin-arm64",
  "darwin-x64",
  "linux-x64-gnu",
  "linux-arm64-gnu",
  "win32-x64-msvc",
];

// Update each platform package.json
for (const platform of platformPackages) {
  const pkgPath = path.join(npmDir, platform, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.warn(`  Skipping ${platform}: ${pkgPath} not found`);
    continue;
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  if (pkg.version !== version) {
    console.log(`  ${platform}: ${pkg.version} -> ${version}`);
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  } else {
    console.log(`  ${platform}: already ${version}`);
  }
}

// Keep the root package pointed at the matching native package versions. npm ci
// requires these optional dependencies to be represented in package-lock.json.
let rootChanged = false;
rootPkg.optionalDependencies ??= {};
for (const platform of platformPackages) {
  const pkgPath = path.join(npmDir, platform, "package.json");
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  if (rootPkg.optionalDependencies[pkg.name] !== version) {
    console.log(`  root optionalDependency ${pkg.name}: ${rootPkg.optionalDependencies[pkg.name] ?? "missing"} -> ${version}`);
    rootPkg.optionalDependencies[pkg.name] = version;
    rootChanged = true;
  }
}
if (rootChanged) {
  fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + "\n");
} else {
  console.log("  root optionalDependencies: already synced");
}

console.log("[sync-platform-versions] Done.");
