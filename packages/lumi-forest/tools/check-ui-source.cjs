/** Dependency-backed syntax check of every UI and Storybook source, never a substitute for a typecheck. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const project = path.resolve(__dirname, '..');
let count = 0;
let errors = 0;
function scan(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const pathName = path.join(dir, item.name);
    if (item.isDirectory()) scan(pathName);
    else if (/\.tsx?$/.test(item.name) && !item.name.endsWith('.d.ts')) {
      count++;
      const r = ts.transpileModule(fs.readFileSync(pathName, 'utf8'), {
        fileName: pathName, reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      });
      for (const error of r.diagnostics || []) if (error.category === ts.DiagnosticCategory.Error) {
        errors++;
        console.error(pathName, ts.flattenDiagnosticMessageText(error.messageText, '\n'));
      }
    }
  }
}
for (const rel of ['src/react-native', 'apps/expo-showcase/src', 'apps/expo-showcase/stories', 'apps/expo-showcase/.rnstorybook']) scan(path.join(project, rel));
console.log(`${count} RN/Storybook TypeScript files checked for syntax; errors: ${errors}. Full native typecheck requires npm dependencies.`);
process.exitCode = errors ? 1 : 0;
