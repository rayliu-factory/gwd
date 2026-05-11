// GWD-2 — Extension Package Format Validator
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

/**
 * Install-time validator for GWD extension packages. Called by the install command
 * (Phase 8) before writing files. Not called on bundled extensions — they are
 * discovered at load time, not installed.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationError {
  code: string;    // "MISSING_GWD_MARKER" | "RESERVED_NAMESPACE" | "WRONG_DEP_FIELD"
  message: string; // Human-readable, actionable
  field?: string;  // e.g. "dependencies", "gwd.extension"
}

export interface ValidationWarning {
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;      // ALWAYS derived as errors.length === 0
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationOptions {
  allowGwdNamespace?: boolean;  // Per D-05: --allow-gwd-namespace flag pass-through
  extensionId?: string;         // The manifest ID to check against gwd.* namespace (per D-04)
}

// ─── Individual Check Functions ───────────────────────────────────────────────

/**
 * Per D-03: Check that pkg.gwd.extension === true with STRICT equality (not truthiness).
 * Packages without this marker are not recognized as GWD extensions.
 */
export function checkInstallDiscriminator(pkg: unknown): ValidationError | null {
  if (typeof pkg !== 'object' || pkg === null) {
    return {
      code: 'MISSING_GWD_MARKER',
      message: 'package.json must declare "gwd": { "extension": true } to be recognized as a GWD extension.',
      field: 'gwd.extension',
    }
  }

  const obj = pkg as Record<string, unknown>
  const gwd = obj.gwd

  if (typeof gwd !== 'object' || gwd === null) {
    return {
      code: 'MISSING_GWD_MARKER',
      message: 'package.json must declare "gwd": { "extension": true } to be recognized as a GWD extension.',
      field: 'gwd.extension',
    }
  }

  const gwdObj = gwd as Record<string, unknown>
  if (gwdObj.extension !== true) {
    return {
      code: 'MISSING_GWD_MARKER',
      message: 'package.json must declare "gwd": { "extension": true } to be recognized as a GWD extension.',
      field: 'gwd.extension',
    }
  }

  return null
}

/**
 * Per D-04/D-05: Check that the extension ID does not use the reserved gwd.* namespace,
 * unless allowGwdNamespace is explicitly set to true.
 * Per D-06: Only checks extension manifest ID — not pkg.name.
 */
export function checkNamespaceReservation(extensionId: string, opts: ValidationOptions): ValidationError | null {
  if (opts.allowGwdNamespace === true) {
    return null
  }

  if (extensionId.startsWith('gwd.')) {
    return {
      code: 'RESERVED_NAMESPACE',
      message: `Extension ID "${extensionId}" is reserved for GWD core extensions. Use a different namespace for community extensions (e.g., "my-tool" or "acme.my-tool"). To override: pass --allow-gwd-namespace (maintainers only).`,
      field: 'extensionId',
    }
  }

  return null
}

/**
 * Per D-07/D-08/D-09/D-10: Scan both `dependencies` and `devDependencies` for @gwd/* packages.
 * peerDependencies is the correct placement and is NOT flagged.
 * Returns an error per violation naming the exact field and package.
 */
export function checkDependencyPlacement(pkg: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof pkg !== 'object' || pkg === null) {
    return errors
  }

  const obj = pkg as Record<string, unknown>

  const fieldsToCheck: Array<{ field: string; reason: string }> = [
    {
      field: 'dependencies',
      reason: 'Extensions must not bundle GWD host packages — the host provides them at runtime.',
    },
    {
      field: 'devDependencies',
      reason: 'GWD host packages are provided by the host at runtime; listing them in devDependencies misrepresents the runtime contract.',
    },
  ]

  for (const { field, reason } of fieldsToCheck) {
    const deps = obj[field]
    if (typeof deps !== 'object' || deps === null) continue

    const depsObj = deps as Record<string, unknown>
    for (const pkgName of Object.keys(depsObj)) {
      if (pkgName.startsWith('@gwd/')) {
        errors.push({
          code: 'WRONG_DEP_FIELD',
          message: `"${pkgName}" must not appear in "${field}". Move it to "peerDependencies". ${reason}`,
          field,
        })
      }
    }
  }

  return errors
}

// ─── Composite Validation ─────────────────────────────────────────────────────

/**
 * Run all validation checks for a GWD extension package.json.
 * - If opts.extensionId is provided, runs namespace reservation check.
 * - If opts.extensionId is not provided, skips namespace check and adds a warning.
 * - valid is ALWAYS derived as errors.length === 0.
 */
export function validateExtensionPackage(pkg: unknown, opts: ValidationOptions = {}): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // Check 1: Install discriminator
  const discriminatorError = checkInstallDiscriminator(pkg)
  if (discriminatorError) {
    errors.push(discriminatorError)
  }

  // Check 2: Namespace reservation (only if extensionId provided)
  if (opts.extensionId !== undefined) {
    const namespaceError = checkNamespaceReservation(opts.extensionId, opts)
    if (namespaceError) {
      errors.push(namespaceError)
    }
  } else {
    warnings.push({
      code: 'NAMESPACE_CHECK_SKIPPED',
      message: 'No extensionId provided — namespace reservation check was skipped.',
    })
  }

  // Check 3: Dependency placement
  const depErrors = checkDependencyPlacement(pkg)
  errors.push(...depErrors)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
