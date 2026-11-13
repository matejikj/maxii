const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, name, 'package.json'), 'utf8'));
const framework = manifest('packages/lumi-forest');
const apps = ['apps/lumi-showcase', 'apps/baby-tracker'];

test('both applications consume the local framework as an npm workspace dependency', () => {
  const workspaces = manifest('.').workspaces;
  assert.ok(workspaces.includes('packages/lumi-forest'));
  for (const app of apps) {
    assert.ok(workspaces.includes(app));
    const pkg = manifest(app);
    assert.equal(pkg.private, true);
    assert.equal(pkg.dependencies[framework.name], framework.version);
    assert.ok(fs.existsSync(path.join(root, app, pkg.main)), `${app}: entry point missing`);
  }
});

function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (
      ['node_modules', '.expo', 'lib', '.test-dist'].includes(entry.name) ||
      entry.name.startsWith('dist-')
    )
      return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? sources(file) : /\.[cm]?[jt]sx?$/.test(file) ? [file] : [];
  });
}

test('framework and production app stay independent of showcase and Storybook code', () => {
  for (const project of ['packages/lumi-forest', 'apps/baby-tracker']) {
    const pkg = manifest(project);
    for (const dependency of Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    })) {
      assert.doesNotMatch(dependency, /storybook|showcase/);
    }
    for (const file of sources(path.join(root, project, 'src'))) {
      const code = fs.readFileSync(file, 'utf8');
      const imports = code.matchAll(
        /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g,
      );
      for (const [, id] of imports) {
        assert.doesNotMatch(id, /storybook|showcase/, `${file}: development application import`);
        if (id.startsWith('.')) {
          assert.ok(
            path.resolve(path.dirname(file), id).startsWith(path.join(root, project) + path.sep),
            `${file}: import escapes project`,
          );
        } else if (id.startsWith('@lumi/forest-design')) {
          const subpath = '.' + id.slice('@lumi/forest-design'.length);
          assert.ok(
            Object.hasOwn(framework.exports, subpath),
            `${file}: private framework import ${id}`,
          );
        }
      }
    }
  }
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, 'apps/baby-tracker/App.tsx'), 'utf8'),
    /storybook|showcase|Lab/,
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, 'apps/baby-tracker/metro.config.js'), 'utf8'),
    /storybook/,
  );
});

test('applications have distinct native identities', () => {
  const [showcase, baby] = apps.map(
    (app) => JSON.parse(fs.readFileSync(path.join(root, app, 'app.json'), 'utf8')).expo,
  );
  for (const key of ['slug', 'scheme']) assert.notEqual(showcase[key], baby[key]);
  assert.notEqual(showcase.android.package, baby.android.package);
  assert.notEqual(showcase.ios.bundleIdentifier, baby.ios.bundleIdentifier);
});

test('the shared lockfile contains one installation of each shared native runtime', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  for (const name of [
    'react',
    'react-native',
    'react-native-reanimated',
    'react-native-worklets',
    'react-native-svg',
    'react-native-safe-area-context',
  ]) {
    const installations = Object.keys(lock.packages).filter((key) =>
      key.endsWith(`node_modules/${name}`),
    );
    assert.equal(
      installations.length,
      1,
      `${name}: duplicate native runtimes: ${installations.join(', ')}`,
    );
  }
});
