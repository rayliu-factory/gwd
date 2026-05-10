// GSD-2 — Extension Validator Tests
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkInstallDiscriminator,
  checkNamespaceReservation,
  checkDependencyPlacement,
  validateExtensionPackage,
} from '../extension-validator.ts'

describe('checkInstallDiscriminator', () => {
  test('returns null for valid gwd.extension === true', () => {
    const result = checkInstallDiscriminator({ gwd: { extension: true }, pi: { extensions: ['./index.ts'] } })
    assert.equal(result, null)
  })

  test('returns error when gwd section is missing', () => {
    const result = checkInstallDiscriminator({ pi: { extensions: ['./index.ts'] } })
    assert.ok(result !== null)
    assert.equal(result.code, 'MISSING_GWD_MARKER')
    assert.equal(result.field, 'gwd.extension')
  })

  test('returns error when gwd.extension is number 1 (not boolean true)', () => {
    const result = checkInstallDiscriminator({ gwd: { extension: 1 } })
    assert.ok(result !== null)
    assert.equal(result.code, 'MISSING_GWD_MARKER', 'strict === true check must reject numeric 1')
  })

  test("returns error when gwd.extension is string 'true'", () => {
    const result = checkInstallDiscriminator({ gwd: { extension: 'true' } })
    assert.ok(result !== null)
    assert.equal(result.code, 'MISSING_GWD_MARKER', "strict === true check must reject string 'true'")
  })

  test('returns error for null input', () => {
    const result = checkInstallDiscriminator(null)
    assert.ok(result !== null)
    assert.equal(result.code, 'MISSING_GWD_MARKER')
  })

  test('returns error when gwd.extension is undefined', () => {
    const result = checkInstallDiscriminator({ gwd: {} })
    assert.ok(result !== null)
    assert.equal(result.code, 'MISSING_GWD_MARKER')
    assert.equal(result.field, 'gwd.extension')
  })

  test('returns error when gwd is an array (not object)', () => {
    const result = checkInstallDiscriminator({ gwd: ['extension'] })
    assert.ok(result !== null)
    assert.equal(result.code, 'MISSING_GWD_MARKER')
  })

  test('returns error when input is a string (not object)', () => {
    const result = checkInstallDiscriminator('{"gwd":{"extension":true}}')
    assert.ok(result !== null)
    assert.equal(result.code, 'MISSING_GWD_MARKER')
  })
})

describe('checkNamespaceReservation', () => {
  test('returns error for gwd. prefixed extension ID', () => {
    const result = checkNamespaceReservation('gwd.my-tool', {})
    assert.ok(result !== null)
    assert.equal(result.code, 'RESERVED_NAMESPACE')
    assert.ok(result.message.includes('gwd.my-tool'), 'error message should name the conflicting ID')
  })

  test('returns null when allowGwdNamespace is true', () => {
    const result = checkNamespaceReservation('gwd.my-tool', { allowGwdNamespace: true })
    assert.equal(result, null)
  })

  test('returns null for non-gwd namespace', () => {
    const result = checkNamespaceReservation('acme.my-tool', {})
    assert.equal(result, null)
  })

  test('returns null for bare extension ID', () => {
    const result = checkNamespaceReservation('my-tool', {})
    assert.equal(result, null)
  })
})

describe('checkDependencyPlacement', () => {
  test('returns error for @gwd/ package in dependencies', () => {
    const errors = checkDependencyPlacement({ dependencies: { '@gwd/pi-coding-agent': '^2.0.0' } })
    assert.equal(errors.length, 1)
    assert.equal(errors[0].code, 'WRONG_DEP_FIELD')
    assert.ok(errors[0].message.includes('@gwd/pi-coding-agent'), 'message must name exact package')
    assert.ok(errors[0].message.includes('dependencies'), 'message must name exact field')
    assert.ok(errors[0].message.includes('peerDependencies'), 'message must suggest the fix')
    assert.equal(errors[0].field, 'dependencies')
  })

  test('returns error for @gwd/ package in devDependencies', () => {
    const errors = checkDependencyPlacement({ devDependencies: { '@gwd/pi-ai': '^1.0.0' } })
    assert.equal(errors.length, 1)
    assert.equal(errors[0].code, 'WRONG_DEP_FIELD')
    assert.ok(errors[0].message.includes('@gwd/pi-ai'), 'message must name exact package')
    assert.ok(errors[0].message.includes('devDependencies'), 'message must name exact field')
    assert.equal(errors[0].field, 'devDependencies')
  })

  test('does not flag @gwd/ in peerDependencies', () => {
    const errors = checkDependencyPlacement({ peerDependencies: { '@gwd/pi-coding-agent': '>=2.50.0' } })
    assert.equal(errors.length, 0, 'peerDependencies is the correct placement — must not be flagged')
  })

  test('returns multiple errors for violations in both dependencies and devDependencies', () => {
    const errors = checkDependencyPlacement({
      dependencies: { '@gwd/pi-coding-agent': '^2.0.0' },
      devDependencies: { '@gwd/pi-ai': '^1.0.0' },
    })
    assert.equal(errors.length, 2)
    const fields = errors.map(e => e.field)
    assert.ok(fields.includes('dependencies'))
    assert.ok(fields.includes('devDependencies'))
  })

  test('does not flag non-GWD host packages', () => {
    const errors = checkDependencyPlacement({ dependencies: { 'lodash': '^4.0.0' } })
    assert.equal(errors.length, 0)
  })

  test('handles missing dependency fields', () => {
    const errors = checkDependencyPlacement({})
    assert.equal(errors.length, 0)
  })

  test('returns empty errors when dependencies is a string instead of object', () => {
    const errors = checkDependencyPlacement({ dependencies: '@gwd/pi-coding-agent' })
    assert.equal(errors.length, 0, 'string in dependencies field should be gracefully skipped')
  })

  test('returns empty errors when dependencies is null', () => {
    const errors = checkDependencyPlacement({ dependencies: null })
    assert.equal(errors.length, 0, 'null dependencies should be gracefully skipped')
  })

  test('returns empty errors when dependencies is an array', () => {
    const errors = checkDependencyPlacement({ dependencies: ['@gwd/pi-coding-agent'] })
    assert.equal(errors.length, 0, 'array in dependencies field should be gracefully skipped')
  })
})

describe('validateExtensionPackage', () => {
  test('returns valid for conforming package', () => {
    const result = validateExtensionPackage(
      { gwd: { extension: true }, peerDependencies: { '@gwd/pi-coding-agent': '>=2.50.0' } },
      { extensionId: 'acme.browser' }
    )
    assert.equal(result.valid, true)
    assert.deepEqual(result.errors, [])
    assert.deepEqual(result.warnings, [])
  })

  test('aggregates errors from multiple checks', () => {
    const result = validateExtensionPackage(
      { dependencies: { '@gwd/pi-ai': '^1.0.0' } },
      { extensionId: 'gwd.bad' }
    )
    assert.equal(result.valid, false)
    // Expects at least: MISSING_GWD_MARKER + RESERVED_NAMESPACE + WRONG_DEP_FIELD
    assert.ok(result.errors.length >= 3, `expected >= 3 errors, got ${result.errors.length}: ${JSON.stringify(result.errors.map(e => e.code))}`)
    const codes = result.errors.map(e => e.code)
    assert.ok(codes.includes('MISSING_GWD_MARKER'))
    assert.ok(codes.includes('RESERVED_NAMESPACE'))
    assert.ok(codes.includes('WRONG_DEP_FIELD'))
  })

  test('valid is always errors.length === 0', () => {
    const validPkg = { gwd: { extension: true } }
    const validResult = validateExtensionPackage(validPkg, { extensionId: 'acme.tool' })
    assert.equal(validResult.valid, true)
    assert.equal(validResult.errors.length, 0)

    const invalidPkg = { gwd: { extension: 1 } }
    const invalidResult = validateExtensionPackage(invalidPkg, { extensionId: 'acme.tool' })
    assert.equal(invalidResult.valid, false)
    assert.ok(invalidResult.errors.length > 0)
  })

  test('adds warning when extensionId is not provided', () => {
    const result = validateExtensionPackage({ gwd: { extension: true } }, {})
    assert.equal(result.valid, true)
    assert.equal(result.warnings.length, 1)
    assert.equal(result.warnings[0].code, 'NAMESPACE_CHECK_SKIPPED')
  })
})

describe('edge cases — field types', () => {
  test('does not flag @gwd/ package nested in sub-object of dependencies (only top-level keys matter)', () => {
    // The checker iterates Object.keys(deps) — a sub-object value is a value, not a key name
    const errors = checkDependencyPlacement({
      dependencies: { nested: { '@gwd/foo': '1.0' } },
    })
    assert.equal(errors.length, 0, 'nested @gwd/ in a sub-object value should not be flagged')
  })
})
