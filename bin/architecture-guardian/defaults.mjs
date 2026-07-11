export const DEFAULT_POLICY = {
  version: 1,
  mode: 'review',
  confidenceThreshold: 0.8,
  blockOn: ['critical', 'high'],
  ignore: [],
  sourceRoots: ['src/**', 'app/**', 'packages/**', 'lib/**', 'bin/**'],
  maxFilesPerChange: 40,
  requireContractForWrites: false,
  forbiddenDependencies: [],
  layers: [],
  deniedExternalPackages: [],
  allowedExternalPackages: [],
  enforceExternalAllowlist: false,
  rules: {
    cycles: { enabled: true, severity: 'high' },
    scope: { enabled: true, severity: 'high' },
    reuse: { enabled: true, severity: 'warning', minimumScore: 0.72 },
    testCompanion: { enabled: false, severity: 'warning' }
  }
};

export const DEFAULT_CONTRACT = {
  version: 1,
  status: 'draft',
  task: '',
  owner: 'unassigned',
  allowedFiles: [],
  forbiddenFiles: [],
  expectedFiles: [],
  allowedNewDependencies: [],
  requiredTests: [],
  notes: []
};
