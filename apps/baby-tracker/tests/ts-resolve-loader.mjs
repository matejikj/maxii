import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

function candidates(specifier, parentURL) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return [];
  }
  const parentPath = parentURL ? path.dirname(new URL(parentURL).pathname) : process.cwd();
  const absolute = path.resolve(parentPath, specifier);
  if (path.extname(absolute)) {
    return [absolute];
  }
  return [
    absolute,
    ...sourceExtensions.map((ext) => absolute + ext),
    ...sourceExtensions.map((ext) => path.join(absolute, 'index' + ext)),
  ];
}

export async function resolve(specifier, context, nextResolve) {
  for (const file of candidates(specifier, context.parentURL)) {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      return nextResolve(pathToFileURL(file).href, context);
    }
  }
  return nextResolve(specifier, context);
}
