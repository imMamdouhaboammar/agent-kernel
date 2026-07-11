const SEVERITIES = new Set(['info', 'warning', 'medium', 'high', 'critical']);
const MODES = new Set(['review', 'strict']);

function issue(path, message) { return { path, message }; }

export function validatePolicy(policy) {
  const issues = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return { ok: false, issues: [issue('$', 'policy must be an object')] };
  if (policy.version !== 1) issues.push(issue('version', 'version must equal 1'));
  if (!MODES.has(policy.mode)) issues.push(issue('mode', 'mode must be review or strict'));
  if (!Number.isFinite(Number(policy.confidenceThreshold)) || Number(policy.confidenceThreshold) < 0 || Number(policy.confidenceThreshold) > 1) issues.push(issue('confidenceThreshold', 'confidenceThreshold must be between 0 and 1'));
  if (!Array.isArray(policy.blockOn) || policy.blockOn.some((value) => !SEVERITIES.has(value))) issues.push(issue('blockOn', 'blockOn must contain valid severity values'));
  if (!Array.isArray(policy.layers)) issues.push(issue('layers', 'layers must be an array'));
  else {
    const names = new Set();
    policy.layers.forEach((layer, index) => {
      if (!layer?.name) issues.push(issue(`layers[${index}].name`, 'layer name is required'));
      else if (names.has(layer.name)) issues.push(issue(`layers[${index}].name`, 'layer names must be unique'));
      else names.add(layer.name);
      if (!Array.isArray(layer?.include) || !layer.include.length) issues.push(issue(`layers[${index}].include`, 'layer include must be a non-empty array'));
      if (!Array.isArray(layer?.mayDependOn)) issues.push(issue(`layers[${index}].mayDependOn`, 'mayDependOn must be an array'));
    });
  }
  if (!Array.isArray(policy.forbiddenDependencies)) issues.push(issue('forbiddenDependencies', 'forbiddenDependencies must be an array'));
  return { ok: issues.length === 0, issues };
}

export function validateContract(contract) {
  const issues = [];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) return { ok: false, issues: [issue('$', 'contract must be an object')] };
  if (contract.version !== 1) issues.push(issue('version', 'version must equal 1'));
  if (!['draft', 'active', 'closed'].includes(contract.status)) issues.push(issue('status', 'status must be draft, active, or closed'));
  if (contract.status === 'active' && !String(contract.task || '').trim()) issues.push(issue('task', 'active contracts require a task'));
  for (const key of ['allowedFiles','forbiddenFiles','expectedFiles','allowedNewDependencies','requiredTests','notes']) {
    if (!Array.isArray(contract[key])) issues.push(issue(key, `${key} must be an array`));
  }
  return { ok: issues.length === 0, issues };
}

export function validateExceptionsDocument(value) {
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, issues: [issue('$', 'exceptions document must be an object')] };
  if (value.version !== 1) issues.push(issue('version', 'version must equal 1'));
  if (!Array.isArray(value.exceptions)) issues.push(issue('exceptions', 'exceptions must be an array'));
  else value.exceptions.forEach((item, index) => {
    if (!item?.id) issues.push(issue(`exceptions[${index}].id`, 'exception id is required'));
    if (!item?.ruleId && !item?.fingerprint) issues.push(issue(`exceptions[${index}]`, 'ruleId or fingerprint is required'));
    if (!item?.reason) issues.push(issue(`exceptions[${index}].reason`, 'reason is required'));
    if (!item?.expiresAt) issues.push(issue(`exceptions[${index}].expiresAt`, 'expiresAt is required'));
    else if (Number.isNaN(Date.parse(item.expiresAt))) issues.push(issue(`exceptions[${index}].expiresAt`, 'expiresAt must be an ISO date'));
  });
  return { ok: issues.length === 0, issues };
}
