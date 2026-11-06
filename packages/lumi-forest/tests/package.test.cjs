const {test} = require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {verify}=require('../tools/verify-built-package.cjs');
test('package gate refuses source-only artifacts without Bob ESM/types',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lumi-package-missing-'));
  try {fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify(require('../package.json')));
    assert.throws(()=>verify(temp),/Bob build output missing/);
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
test('package gate accepts a structurally valid synthetic output for all public entries',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lumi-package-'));
  try {
    const original=require('../package.json');
    fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify(original));
    const target=new Set(['lib/module/index.js','lib/module/core/index.js','lib/module/react-native/index.js',
      'lib/typescript/src/index.d.ts','lib/typescript/src/core/index.d.ts','lib/typescript/src/react-native/index.d.ts']);
    for(const f of target) {const file=path.join(temp,f);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'// test-only compiled artifact\nexport {};\n');}
    assert.equal(verify(temp).status,'ready-for-pack');
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
