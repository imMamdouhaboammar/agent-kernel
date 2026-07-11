export function findCycles(adjacency) {
  const cycles = [];
  const state = new Map();
  const stack = [];
  const positions = new Map();
  function visit(node) {
    state.set(node, 1);
    positions.set(node, stack.length);
    stack.push(node);
    for (const next of adjacency.get(node) || []) {
      if (!state.has(next)) visit(next);
      else if (state.get(next) === 1) {
        const start = positions.get(next);
        const cycle = [...stack.slice(start), next];
        const signature = canonicalCycle(cycle);
        if (!cycles.some((item) => item.signature === signature)) cycles.push({ signature, path: cycle });
      }
    }
    stack.pop();
    positions.delete(node);
    state.set(node, 2);
  }
  for (const node of [...adjacency.keys()].sort()) if (!state.has(node)) visit(node);
  return cycles.sort((a, b) => a.signature.localeCompare(b.signature));
}
function canonicalCycle(path) {
  const nodes = path.slice(0, -1);
  const rotations = nodes.map((_, index) => [...nodes.slice(index), ...nodes.slice(0, index)]);
  return rotations.map((items) => items.join(' -> ')).sort()[0] || '';
}
