function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function duplicateValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return sortedUnique(values.filter((value) => counts.get(value) > 1));
}

export function inspectSmokeRegistration({
  candidateFiles,
  registrations,
  ignoredFiles = [],
  delegatedFiles = []
}) {
  const ignored = new Set(ignoredFiles);
  const delegated = new Set(delegatedFiles);
  const candidates = sortedUnique(
    candidateFiles.filter((file) => file.endsWith('.mjs') && !ignored.has(file))
  );
  const registeredFiles = registrations.map((registration) => registration.file);
  const registeredNames = registrations.map((registration) => registration.name);
  const candidateSet = new Set(candidates);
  const registeredSet = new Set(registeredFiles);

  return {
    candidateFiles: candidates,
    unregisteredFiles: candidates.filter((file) => !delegated.has(file) && !registeredSet.has(file)),
    duplicateScheduledModules: duplicateValues(registeredFiles),
    duplicateTestNames: duplicateValues(registeredNames),
    delegatedButScheduled: sortedUnique(
      registeredFiles.filter((file) => delegated.has(file))
    ),
    missingRegisteredFiles: sortedUnique(
      registeredFiles.filter((file) => !candidateSet.has(file))
    ),
    invalidDelegatedFiles: sortedUnique(
      delegatedFiles.filter((file) => !candidateSet.has(file))
    )
  };
}

export function assertSmokeRegistration(options) {
  const report = inspectSmokeRegistration(options);
  const failures = [];
  if (report.unregisteredFiles.length) {
    failures.push(`Unregistered smoke modules: ${report.unregisteredFiles.join(', ')}`);
  }
  if (report.duplicateScheduledModules.length) {
    failures.push(`Smoke modules scheduled more than once: ${report.duplicateScheduledModules.join(', ')}`);
  }
  if (report.duplicateTestNames.length) {
    failures.push(`Smoke test names used more than once: ${report.duplicateTestNames.join(', ')}`);
  }
  if (report.delegatedButScheduled.length) {
    failures.push(`Delegated smoke modules must not be scheduled directly: ${report.delegatedButScheduled.join(', ')}`);
  }
  if (report.missingRegisteredFiles.length) {
    failures.push(`Registered smoke modules do not exist: ${report.missingRegisteredFiles.join(', ')}`);
  }
  if (report.invalidDelegatedFiles.length) {
    failures.push(`Delegated smoke modules do not exist: ${report.invalidDelegatedFiles.join(', ')}`);
  }
  if (failures.length) {
    throw new Error(`Smoke registration contract failed\n- ${failures.join('\n- ')}`);
  }
  return report;
}
