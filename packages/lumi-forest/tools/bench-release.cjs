#!/usr/bin/env node
/** CPU-only diagnostic. NEVER label its p95 as mobile FPS or GPU rendering. */
const {performance} = require('node:perf_hooks');
const fs = require('node:fs');
const os = require('node:os');
const {composeScene, planProceduralScene, compileCharacter, CHARACTER_BLUEPRINTS,
  LUMI_SCENES, countVectorNodes, LUMI_PERFORMANCE_BUDGETS} = require('../.test-dist/core/index.js');
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
const fixture = (task, iterations=2500) => {
  for(let i=0;i<300;i++) task(i);
  const times=[];
  for(let i=0;i<iterations;i++) {
    const start=performance.now();task(i);times.push(performance.now()-start);
  }
  times.sort((a,b)=>a-b);
  return {iterations,p50Ms:+percentile(times,0.5).toFixed(4),p95Ms:+percentile(times,0.95).toFixed(4),p99Ms:+percentile(times,0.99).toFixed(4)};
};
const cases={
  legacyScene:fixture(i=>composeScene({scene:LUMI_SCENES[i%5],seed:`bm:${i}`})),
  proceduralScene:fixture(i=>planProceduralScene({scene:LUMI_SCENES[i%5],seed:`bm:${i}`,viewport:{width:390,height:844},density:'regular'})),
  characterCacheHit:fixture(()=>compileCharacter(CHARACTER_BLUEPRINTS.rabbit,{pose:'standing',expression:'curious'})),
  characterUncached:fixture(i=>compileCharacter(CHARACTER_BLUEPRINTS.fox,{pose:'standing',expression:'happy',proportions:{head:1.01+(i%5)*0.002}})),
};
const nodeCounts={
  maxLegacy: Math.max(...LUMI_SCENES.map(scene=>countVectorNodes(composeScene({scene,seed:'release'})))),
  maxProcedural: Math.max(...LUMI_SCENES.map(scene=>countVectorNodes(planProceduralScene({scene,seed:'release',viewport:{width:1024,height:768}}).document))),
};
if(nodeCounts.maxLegacy>LUMI_PERFORMANCE_BUDGETS.maxVectorNodesPerScene ||
   nodeCounts.maxProcedural>LUMI_PERFORMANCE_BUDGETS.maxProceduralVectorNodes) throw Error('IR complexity budget exceeded');
const data={kind:'node-cpu-only-NOT-device-verified',node:process.version,platform:process.platform,
  architecture:process.arch,cpuModel:os.cpus()[0]?.model ?? 'unknown',scenes:LUMI_SCENES.length,nodeCounts,cases};
const output=process.argv[2];
if(output) {fs.mkdirSync(require('node:path').dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');}
console.log(JSON.stringify(data,null,2));
