export function findCycles(adjacency) {
  const cycles = [];
  const signatures = new Set();
  const state = new Map();
  const path = [];
  const positions = new Map();

  function pushFrame(frames, node) {
    state.set(node, 1);
    positions.set(node, path.length);
    path.push(node);
    frames.push({ node, index: 0, neighbors: [...(adjacency.get(node) || [])].sort() });
  }

  for (const startNode of [...adjacency.keys()].sort()) {
    if (state.has(startNode)) continue;
    const frames = [];
    pushFrame(frames, startNode);

    while (frames.length) {
      const frame = frames[frames.length - 1];
      if (frame.index >= frame.neighbors.length) {
        frames.pop();
        path.pop();
        positions.delete(frame.node);
        state.set(frame.node, 2);
        continue;
      }

      const next = frame.neighbors[frame.index++];
      if (!state.has(next)) {
        pushFrame(frames, next);
        continue;
      }
      if (state.get(next) !== 1) continue;

      const start = positions.get(next);
      if (start === undefined) continue;
      const cycle = [...path.slice(start), next];
      const signature = canonicalCycle(cycle);
      if (signatures.has(signature)) continue;
      signatures.add(signature);
      cycles.push({ signature, path: cycle });
    }
  }

  return cycles.sort((a, b) => a.signature.localeCompare(b.signature));
}

function canonicalCycle(path) {
  const nodes = path.slice(0, -1);
  if (!nodes.length) return '';
  let smallest = 0;
  for (let index = 1; index < nodes.length; index++) {
    if (nodes[index].localeCompare(nodes[smallest]) < 0) smallest = index;
  }
  return [...nodes.slice(smallest), ...nodes.slice(0, smallest)].join(' -> ');
}
