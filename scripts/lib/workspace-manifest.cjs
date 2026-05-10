// GWD + scripts/lib/workspace-manifest.cjs — single source of truth for linkable @gwd/* packages
'use strict'

const { readdirSync, readFileSync, existsSync, statSync } = require('fs')
const { join, resolve } = require('path')

const REPO_ROOT = resolve(__dirname, '..', '..')
const PACKAGES_DIR = join(REPO_ROOT, 'packages')

/**
 * Returns the canonical list of linkable workspace packages.
 *
 * A package is "linkable" if its `package.json` contains:
 *   { "gwd": { "linkable": true, "scope": "@gwd" | "@gwd-build", "name": "<pkgname>" } }
 *
 * Each returned entry has:
 *   - dir: directory name under packages/ (e.g. "gwd-agent-core")
 *   - scope: "@gwd" or "@gwd-build"
 *   - name: unscoped package name (e.g. "agent-core")
 *   - packageName: scoped name (e.g. "@gwd/agent-core")
 *   - path: absolute path to package directory
 *   - packageJsonPath: absolute path to its package.json
 *
 * Used by:
 *   - scripts/link-workspace-packages.cjs (node_modules linkage)
 *   - src/loader.ts (via scripts/generate-ws-packages.cjs)
 *   - scripts/validate-pack.js (pack-install smoke checks)
 *   - scripts/verify-workspace-coverage.cjs (CI coverage gate)
 */
function getLinkablePackages() {
	if (!existsSync(PACKAGES_DIR)) return []
	const entries = readdirSync(PACKAGES_DIR)
	const out = []
	for (const dir of entries) {
		const pkgPath = join(PACKAGES_DIR, dir)
		if (!statSync(pkgPath).isDirectory()) continue
		const pkgJsonPath = join(pkgPath, 'package.json')
		if (!existsSync(pkgJsonPath)) continue
		let pkg
		try {
			pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
		} catch (err) {
			throw new Error(`Invalid package.json at ${pkgJsonPath}: ${err.message}`)
		}
		const gwd = pkg.gwd
		if (!gwd || gwd.linkable !== true) continue
		if (!gwd.scope || !gwd.name) {
			throw new Error(
				`${pkgJsonPath}: "gwd.linkable" is true but "gwd.scope" or "gwd.name" is missing.`
			)
		}
		if (gwd.scope !== '@gwd' && gwd.scope !== '@gwd-build') {
			throw new Error(
				`${pkgJsonPath}: "gwd.scope" must be "@gwd" or "@gwd-build" (got "${gwd.scope}").`
			)
		}
		const expectedName = `${gwd.scope}/${gwd.name}`
		if (pkg.name !== expectedName) {
			throw new Error(
				`${pkgJsonPath}: package.json "name" (${pkg.name}) does not match gwd.scope/gwd.name (${expectedName}).`
			)
		}
		out.push({
			dir,
			scope: gwd.scope,
			name: gwd.name,
			packageName: pkg.name,
			path: pkgPath,
			packageJsonPath: pkgJsonPath,
		})
	}
	out.sort((a, b) => a.packageName.localeCompare(b.packageName))
	return out
}

/** Returns only packages in the `@gwd` scope (excludes `@gwd-build`). */
function getCorePackages() {
	return getLinkablePackages().filter((p) => p.scope === '@gwd')
}

module.exports = {
	REPO_ROOT,
	PACKAGES_DIR,
	getLinkablePackages,
	getCorePackages,
}
