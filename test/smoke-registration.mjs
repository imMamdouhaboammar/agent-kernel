// test/smoke-registration.mjs — Registration contract for focused smoke modules

import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertSmokeRegistration,
  inspectSmokeRegistration
} from './_lib/smoke-registration.mjs';

export async function run() {
  const directory = mkdtempSync(join(tmpdir(), 'agent-kernel-smoke-registration-'));
  try {
    for (const file of [
      'registered.mjs',
      'missing-a.mjs',
      'missing-b.mjs',
      'imported-only.mjs',
      'duplicate.mjs',
      'smoke.mjs',
      'ci-hardening.mjs'
    ]) {
      writeFileSync(join(directory, file), `// ${file}\n`, 'utf8');
    }

    const source = `
import { run as runRegistered } from './registered.mjs';
import { run as runImportedOnly } from './imported-only.mjs';
import { run as runDuplicate } from './duplicate.mjs';
const tests = [
  ['registered', runRegistered],
  ['duplicate-a', runDuplicate],
  ['duplicate-b', runDuplicate]
];
`;

    const report = inspectSmokeRegistration({
      testDirectory: directory,
      smokeSource: source,
      ignoredFiles: ['smoke.mjs', 'ci-hardening.mjs']
    });

    assert.deepStrictEqual(report.unregisteredFiles, ['missing-a.mjs', 'missing-b.mjs']);
    assert.deepStrictEqual(report.importedButUnscheduled, ['imported-only.mjs']);
    assert.deepStrictEqual(report.duplicateScheduledModules, ['duplicate.mjs']);

    assert.throws(
      () => assertSmokeRegistration({
        testDirectory: directory,
        smokeSource: source,
        ignoredFiles: ['smoke.mjs', 'ci-hardening.mjs']
      }),
      (error) => {
        assert.match(error.message, /missing-a\.mjs, missing-b\.mjs/);
        assert.match(error.message, /imported-only\.mjs/);
        assert.match(error.message, /duplicate\.mjs/);
        return true;
      }
    );

    const healthySource = `
import { run as runRegistered } from './registered.mjs';
import { run as runMissingA } from './missing-a.mjs';
import { run as runMissingB } from './missing-b.mjs';
import { run as runImportedOnly } from './imported-only.mjs';
import { run as runDuplicate } from './duplicate.mjs';
const tests = [
  ['registered', runRegistered],
  ['missing-a', runMissingA],
  ['missing-b', runMissingB],
  ['imported-only', runImportedOnly],
  ['duplicate', runDuplicate]
];
`;

    assert.doesNotThrow(() => assertSmokeRegistration({
      testDirectory: directory,
      smokeSource: healthySource,
      ignoredFiles: ['smoke.mjs', 'ci-hardening.mjs']
    }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export const name = 'smoke-registration';
