// test/smoke-registration.mjs — Registration contract for focused smoke modules

import assert from 'node:assert';
import {
  assertSmokeRegistration,
  inspectSmokeRegistration
} from './_lib/smoke-registration.mjs';

const candidateFiles = [
  'registered.mjs',
  'missing-a.mjs',
  'missing-b.mjs',
  'duplicate.mjs',
  'same-name-a.mjs',
  'same-name-b.mjs',
  'delegated.mjs',
  'smoke.mjs',
  'ci-hardening.mjs'
];
const ignoredFiles = ['smoke.mjs', 'ci-hardening.mjs'];
const unhealthyRegistrations = [
  { name: 'registered', file: 'registered.mjs' },
  { name: 'duplicate-a', file: 'duplicate.mjs' },
  { name: 'duplicate-b', file: 'duplicate.mjs' },
  { name: 'same-name', file: 'same-name-a.mjs' },
  { name: 'same-name', file: 'same-name-b.mjs' },
  { name: 'absent', file: 'absent.mjs' }
];

function assertUnhealthyReport() {
  const report = inspectSmokeRegistration({
    candidateFiles,
    registrations: unhealthyRegistrations,
    ignoredFiles,
    delegatedFiles: ['delegated.mjs']
  });
  assert.deepStrictEqual(report.unregisteredFiles, ['missing-a.mjs', 'missing-b.mjs']);
  assert.deepStrictEqual(report.duplicateScheduledModules, ['duplicate.mjs']);
  assert.deepStrictEqual(report.duplicateTestNames, ['same-name']);
  assert.deepStrictEqual(report.missingRegisteredFiles, ['absent.mjs']);
  assert.deepStrictEqual(report.invalidDelegatedFiles, []);
}

function assertActionableFailure() {
  assert.throws(
    () => assertSmokeRegistration({
      candidateFiles,
      registrations: unhealthyRegistrations,
      ignoredFiles,
      delegatedFiles: ['delegated.mjs', 'missing-delegated.mjs']
    }),
    (error) => {
      assert.match(error.message, /missing-a\.mjs, missing-b\.mjs/);
      assert.match(error.message, /duplicate\.mjs/);
      assert.match(error.message, /same-name/);
      assert.match(error.message, /absent\.mjs/);
      assert.match(error.message, /missing-delegated\.mjs/);
      return true;
    }
  );
}

function assertHealthyRegistry() {
  const registrations = candidateFiles
    .filter((file) => file !== 'delegated.mjs' && !ignoredFiles.includes(file))
    .map((file) => ({ name: file.replace(/\.mjs$/, ''), file }));
  assert.doesNotThrow(() => assertSmokeRegistration({
    candidateFiles,
    registrations,
    ignoredFiles,
    delegatedFiles: ['delegated.mjs']
  }));
}

export async function run() {
  assertUnhealthyReport();
  assertActionableFailure();
  assertHealthyRegistry();
}

export const name = 'smoke-registration';
