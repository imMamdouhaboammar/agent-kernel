import path from 'node:path';

export function prependPathEntry(entry, currentPath = '', delimiter = path.delimiter) {
  return currentPath ? `${entry}${delimiter}${currentPath}` : entry;
}
