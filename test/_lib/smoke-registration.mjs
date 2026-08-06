import fs from 'node:fs';
import path from 'node:path';

function importedRunModules(smokeSource) {
  const modules = [];
  const pattern = /import\s+\{\s*run\s+as\s+([A-Za-z_$][\w$]*)\s*\}\s+from\s+['"]\.\/([^'"]+\.mjs)['"]/g;
  for (const match of String(smokeSource || '').matchAll(pattern)) {
    modules.push({ alias: match[1], file: match[2] });
  }
  return modules;
}

function scheduledRunAliases(smokeSource) {
  const source = String(smokeSource || '');
  const testsBlock = source.match(/const\s+tests\s*=\s*\[([\s\S]*?)\n\];/);
  if (!testsBlock) return [];
  const aliases = [];
  const entryPattern = /\[\s*['"][^'"]+['"]\s*,\s*([A-Za-z_$][\w$]*)\s*\]/g;
  for (const match of testsBlock[1].matchAll(entryPattern)) aliases.push(match[1]);
  return aliases;
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function inspectSmokeRegistration({
  testDirectory,
  smokeSource,
  ignoredFiles = [],
  delegatedFiles = []
}) {
  const ignored = new Set(ignoredFiles);
  const delegated = new Set(delegatedFiles);
  const candidateFiles = fs
    .readdirSync(testDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs') && !ignored.has(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const imports = importedRunModules(smokeSource);
  const importedFiles = new Set(imports.map((entry) => entry.file));
  const scheduledAliases = scheduledRunAliases(smokeSource);
  const scheduleCounts = new Map();
  for (const alias of scheduledAliases) scheduleCounts.set(alias, (scheduleCounts.get(alias) || 0) + 1);

  const unregisteredFiles = candidateFiles.filter((file) => !delegated.has(file) && !importedFiles.has(file));
  const importedButUnscheduled = imports
    .filter((entry) => !delegated.has(entry.file) && (scheduleCounts.get(entry.alias) || 0) === 0)
    .map((entry) => entry.file);
  const duplicateScheduledModules = imports
    .filter((entry) => (scheduleCounts.get(entry.alias) || 0) > 1)
    .map((entry) => entry.file);

  const duplicateImportedModules = imports
    .filter((entry, index) => imports.findIndex((candidate) => candidate.file === entry.file) !== index)
    .map((entry) => entry.file);

  const importedOutsideTestDirectory = imports
    .filter((entry) => {
      const resolved = path.resolve(testDirectory, entry.file);
      const relative = path.relative(testDirectory, resolved);
      return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
    })
    .map((entry) => entry.file);

  const invalidDelegatedFiles = delegatedFiles.filter((file) => !candidateFiles.includes(file));

  return {
    candidateFiles,
    unregisteredFiles: sortedUnique(unregisteredFiles),
    importedButUnscheduled: sortedUnique(importedButUnscheduled),
    duplicateScheduledModules: sortedUnique(duplicateScheduledModules),
    duplicateImportedModules: sortedUnique(duplicateImportedModules),
    importedOutsideTestDirectory: sortedUnique(importedOutsideTestDirectory),
    invalidDelegatedFiles: sortedUnique(invalidDelegatedFiles)
  };
}

export function assertSmokeRegistration(options) {
  const report = inspectSmokeRegistration(options);
  const failures = [];
  if (report.unregisteredFiles.length) {
    failures.push(`Unregistered smoke modules: ${report.unregisteredFiles.join(', ')}`);
  }
  if (report.importedButUnscheduled.length) {
    failures.push(`Imported but unscheduled smoke modules: ${report.importedButUnscheduled.join(', ')}`);
  }
  if (report.duplicateScheduledModules.length) {
    failures.push(`Smoke modules scheduled more than once: ${report.duplicateScheduledModules.join(', ')}`);
  }
  if (report.duplicateImportedModules.length) {
    failures.push(`Smoke modules imported more than once: ${report.duplicateImportedModules.join(', ')}`);
  }
  if (report.importedOutsideTestDirectory.length) {
    failures.push(`Smoke module imports escape test directory: ${report.importedOutsideTestDirectory.join(', ')}`);
  }
  if (report.invalidDelegatedFiles.length) {
    failures.push(`Delegated smoke modules do not exist: ${report.invalidDelegatedFiles.join(', ')}`);
  }
  if (failures.length) {
    throw new Error(`Smoke registration contract failed\n- ${failures.join('\n- ')}`);
  }
  return report;
}
