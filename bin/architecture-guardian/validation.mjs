const SEVERITIES = new Set(['info', 'warning', 'medium', 'high', 'critical']);
const MODES = new Set(['review', 'strict']);
const ENFORCEMENT = new Set(['review', 'block']);

function issue(path, message) { return { path, message }; }
function stringArray(value) { return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim()); }
function nonEmptyStringArray(value) { return stringArray(value) && value.length > 0; }
function validDate(value) { return typeof value === 'string' && value.trim() && !Number.isNaN(Date.parse(value)); }
function validateRuleConfig(value, path, issues) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(issue(path, 'rule config must be an object'));
    return;
  }
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') issues.push(issue(`${path}.enabled`, 'enabled must be a boolean'));
  if (value.severity !== undefined && !SEVERITIES.has(value.severity)) issues.push(issue(`${path}.severity`, 'severity is invalid'));
  if (value.minimumScore !== undefined && (!Number.isFinite(Number(value.minimumScore)) || Number(value.minimumScore) < 0 || Number(value.minimumScore) > 1)) {
    issues.push(issue(`${path}.minimumScore`, 'minimumScore must be between 0 and 1'));
  }
}

export function validatePolicy(policy) {
  const issues = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return { ok: false, issues: [issue('$', 'policy must be an object')] };
  if (policy.version !== 1) issues.push(issue('version', 'version must equal 1'));
  if (!MODES.has(policy.mode)) issues.push(issue('mode', 'mode must be review or strict'));
  if (!Number.isFinite(Number(policy.confidenceThreshold)) || Number(policy.confidenceThreshold) < 0 || Number(policy.confidenceThreshold) > 1) issues.push(issue('confidenceThreshold', 'confidenceThreshold must be between 0 and 1'));
  if (!Array.isArray(policy.blockOn) || policy.blockOn.some((value) => !SEVERITIES.has(value))) issues.push(issue('blockOn', 'blockOn must contain valid severity values'));
  for (const key of ['ignore', 'sourceRoots', 'deniedExternalPackages', 'allowedExternalPackages']) {
    if (!stringArray(policy[key])) issues.push(issue(key, `${key} must be an array of non-empty strings`));
  }
  if (!Number.isInteger(Number(policy.maxFilesPerChange)) || Number(policy.maxFilesPerChange) < 1) issues.push(issue('maxFilesPerChange', 'maxFilesPerChange must be a positive integer'));
  if (typeof policy.requireContractForWrites !== 'boolean') issues.push(issue('requireContractForWrites', 'requireContractForWrites must be a boolean'));
  if (typeof policy.enforceExternalAllowlist !== 'boolean') issues.push(issue('enforceExternalAllowlist', 'enforceExternalAllowlist must be a boolean'));
  if (!Array.isArray(policy.layers)) issues.push(issue('layers', 'layers must be an array'));
  else {
    const names = new Set();
    policy.layers.forEach((layer, index) => {
      const base = `layers[${index}]`;
      if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
        issues.push(issue(base, 'layer must be an object'));
        return;
      }
      if (!layer.name || typeof layer.name !== 'string') issues.push(issue(`${base}.name`, 'layer name is required'));
      else if (names.has(layer.name)) issues.push(issue(`${base}.name`, 'layer names must be unique'));
      else names.add(layer.name);
      if (!nonEmptyStringArray(layer.include)) issues.push(issue(`${base}.include`, 'layer include must be a non-empty string array'));
      if (!Array.isArray(layer.mayDependOn) || layer.mayDependOn.some((value) => typeof value !== 'string')) issues.push(issue(`${base}.mayDependOn`, 'mayDependOn must be a string array'));
      if (layer.severity !== undefined && !SEVERITIES.has(layer.severity)) issues.push(issue(`${base}.severity`, 'severity is invalid'));
      if (layer.enforcement !== undefined && !ENFORCEMENT.has(layer.enforcement)) issues.push(issue(`${base}.enforcement`, 'enforcement must be review or block'));
    });
  }
  if (!Array.isArray(policy.forbiddenDependencies)) issues.push(issue('forbiddenDependencies', 'forbiddenDependencies must be an array'));
  else policy.forbiddenDependencies.forEach((rule, index) => {
    const base = `forbiddenDependencies[${index}]`;
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      issues.push(issue(base, 'dependency rule must be an object'));
      return;
    }
    if (!nonEmptyStringArray(rule.from)) issues.push(issue(`${base}.from`, 'from must be a non-empty string array'));
    if (!nonEmptyStringArray(rule.to)) issues.push(issue(`${base}.to`, 'to must be a non-empty string array'));
    if (rule.severity !== undefined && !SEVERITIES.has(rule.severity)) issues.push(issue(`${base}.severity`, 'severity is invalid'));
    if (rule.enforcement !== undefined && !ENFORCEMENT.has(rule.enforcement)) issues.push(issue(`${base}.enforcement`, 'enforcement must be review or block'));
  });
  if (!policy.rules || typeof policy.rules !== 'object' || Array.isArray(policy.rules)) issues.push(issue('rules', 'rules must be an object'));
  else for (const [name, value] of Object.entries(policy.rules)) validateRuleConfig(value, `rules.${name}`, issues);
  return { ok: issues.length === 0, issues };
}

export function validateContract(contract) {
  const issues = [];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) return { ok: false, issues: [issue('$', 'contract must be an object')] };
  if (contract.version !== 1) issues.push(issue('version', 'version must equal 1'));
  if (!['draft', 'active', 'closed'].includes(contract.status)) issues.push(issue('status', 'status must be draft, active, or closed'));
  if (typeof contract.task !== 'string') issues.push(issue('task', 'task must be a string'));
  else if (contract.status === 'active' && !contract.task.trim()) issues.push(issue('task', 'active contracts require a task'));
  if (typeof contract.owner !== 'string' || !contract.owner.trim()) issues.push(issue('owner', 'owner must be a non-empty string'));
  for (const key of ['allowedFiles','forbiddenFiles','expectedFiles','allowedNewDependencies','requiredTests','notes']) {
    if (!stringArray(contract[key])) issues.push(issue(key, `${key} must be an array of strings`));
  }
  if (contract.maxFiles !== undefined && (!Number.isInteger(Number(contract.maxFiles)) || Number(contract.maxFiles) < 1)) issues.push(issue('maxFiles', 'maxFiles must be a positive integer'));
  return { ok: issues.length === 0, issues };
}

export function validateExceptionsDocument(value) {
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, issues: [issue('$', 'exceptions document must be an object')] };
  if (value.version !== 1) issues.push(issue('version', 'version must equal 1'));
  if (!Array.isArray(value.exceptions)) issues.push(issue('exceptions', 'exceptions must be an array'));
  else value.exceptions.forEach((item, index) => {
    const base = `exceptions[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      issues.push(issue(base, 'exception must be an object'));
      return;
    }
    if (!item.id || typeof item.id !== 'string') issues.push(issue(`${base}.id`, 'exception id is required'));
    if (!item.ruleId && !item.fingerprint) issues.push(issue(base, 'ruleId or fingerprint is required'));
    if (item.ruleId !== null && item.ruleId !== undefined && typeof item.ruleId !== 'string') issues.push(issue(`${base}.ruleId`, 'ruleId must be a string or null'));
    if (item.fingerprint !== null && item.fingerprint !== undefined && typeof item.fingerprint !== 'string') issues.push(issue(`${base}.fingerprint`, 'fingerprint must be a string or null'));
    if (!Array.isArray(item.files) || item.files.some((file) => typeof file !== 'string')) issues.push(issue(`${base}.files`, 'files must be a string array'));
    if (!item.reason || typeof item.reason !== 'string') issues.push(issue(`${base}.reason`, 'reason is required'));
    if (!item.owner || typeof item.owner !== 'string') issues.push(issue(`${base}.owner`, 'owner is required'));
    if (!validDate(item.createdAt)) issues.push(issue(`${base}.createdAt`, 'createdAt must be an ISO date'));
    if (!validDate(item.expiresAt)) issues.push(issue(`${base}.expiresAt`, 'expiresAt must be an ISO date'));
    if (!['active', 'revoked'].includes(item.status)) issues.push(issue(`${base}.status`, 'status must be active or revoked'));
  });
  return { ok: issues.length === 0, issues };
}
