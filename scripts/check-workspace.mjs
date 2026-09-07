import { access } from 'node:fs/promises';
import path from 'node:path';

// M0 requires these files to exist so accidental deletion fails CI.
const requiredPaths = [
  'docs/protocol.md',
  'docs/adapter-contract.md',
  'packages/core/package.json',
  'packages/headless/package.json',
  'packages/adapter-mock/package.json',
  'packages/form/package.json',
  'examples/mock-vue2/package.json',
];

const workspaceNames = [
  '@flowkit/core',
  '@flowkit/headless',
  '@flowkit/adapter-mock',
  '@flowkit/form',
  '@flowkit/example-mock-vue2',
];

const root = process.cwd();
const missing = [];

// Collect every missing path before failing so CI reports the full list.
for (const relativePath of requiredPaths) {
  try {
    await access(path.join(root, relativePath));
  } catch {
    missing.push(relativePath);
  }
}

if (missing.length > 0) {
  console.error(`Missing required workspace files: ${missing.join(', ')}`);
  process.exitCode = 1;
}

const packageManifests = await Promise.all(
  requiredPaths
    .filter((relativePath) => relativePath.endsWith('package.json'))
    .map(async (relativePath) => {
      const manifest = await import(path.join(root, relativePath), { with: { type: 'json' } });
      return manifest.default.name;
    }),
);

// Workspace package names are part of the public package layout, not labels.
const missingNames = workspaceNames.filter((name) => !packageManifests.includes(name));

if (missingNames.length > 0) {
  console.error(`Missing workspace package names: ${missingNames.join(', ')}`);
  process.exitCode = 1;
}

if (process.exitCode === undefined) {
  console.log('Workspace structure is valid.');
}
