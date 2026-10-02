import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadTs} from './mc-test-runtime.mjs';
import {jvmProbePassed} from './mc-jvm-probe-result.mjs';
import {verifyJvmProbeClassifier} from './verify-mc-jvm-probe-result.mjs';

// Portable runtimes are only read from coverage or explicit --java11-home /
// --java16-home. Every Java call is a small-heap -version probe, never a game.
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const cache=join(root,'coverage/server-launch-java1116');
const binary=process.platform==='win32'?'java.exe':'java';
const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const requestedMajor=option('--major');
assert.ok(requestedMajor===undefined||['11','16'].includes(requestedMajor),'--major must be 11 or 16');
const majors=requestedMajor?[Number(requestedMajor)]:[11,16];
const classifierChecks=verifyJvmProbeClassifier();
const env={...process.env};for(const key of ['_JAVA_OPTIONS','JAVA_TOOL_OPTIONS','JDK_JAVA_OPTIONS']) delete env[key];
const {makeServerLaunch,SERVER_JVM_FLAGS,SERVER_GC_OPTIONS,flagSupportReason}=loadTs('../src/lib/mc/server-launch.ts');
function runtimeHome(directory){
 if(!existsSync(directory)) return undefined;
 if(existsSync(join(directory,'bin',binary))) return directory;
 for(const entry of readdirSync(directory,{withFileTypes:true})) if(entry.isDirectory()){
  const home=runtimeHome(join(directory,entry.name));if(home) return home;
 }
}
const reports=[];
for(const major of majors){
 const home=option(`--java${major}-home`)??option('--java-home')??(requestedMajor?process.env.JAVA_HOME:undefined)??runtimeHome(join(cache,`java${major}-runtime`));
 assert.ok(home,`Java ${major} is missing: supply --java${major}-home; this audit never installs a runtime`);
 const java=join(resolve(home),'bin',binary),cwd=join(cache,`java${major}-probes`);mkdirSync(cwd,{recursive:true});
 const meta=join(cache,`java${major}-asset.json`),runtimeRelative=relative(join(cache,`java${major}-runtime`),java);
 const isCached=!isAbsolute(runtimeRelative)&&!runtimeRelative.startsWith('..');
 const receipt=isCached&&existsSync(meta)?JSON.parse(readFileSync(meta,'utf8')):null;
 if(receipt){const bytes=readFileSync(receipt.archive);assert.equal(createHash('sha256').update(bytes).digest('hex'),receipt.asset.binary.package.checksum);assert.equal(bytes.length,receipt.asset.binary.package.size);}
 const records=[],counts={controls:0,defaults:0,bounds:0,collectors:0,productGuards:0};
 const prefix=['-Xms32m','-Xmx64m'];
 function probe(id,args,expected='accept',category='controls'){
  assert.ok(!args.includes('-jar')&&args.at(-1)==='-version',`${id}: only -version is permitted`);
  const result=spawnSync(java,args,{cwd,env,windowsHide:true,timeout:15000,encoding:'utf8',maxBuffer:1024*1024});
  if(result.error) throw new Error(`${major}/${id}: native probe failed to run`,{cause:result.error});
  const output=`${result.stdout??''}${result.stderr??''}`;
  const pass=jvmProbePassed(result,expected);
  records.push({id,args,expected,exitCode:result.status,signal:result.signal??null,pass,output});counts[category]++;return output;
 }
 const runtime=probe('runtime',[...prefix,'-version']);
 const versionPattern=new RegExp(`(?:version|openjdk) "${major}(?:\\.|"|\\+)`);
 for(const sample of [`openjdk version "${major}"`,`openjdk version "${major}.0.2"`,`openjdk version "${major}+7"`]) assert.match(sample,versionPattern);
 assert.doesNotMatch(`openjdk version "${major}0.0.2"`,versionPattern);
 assert.match(runtime,versionPattern);
 const fixed=[
  ['g1',['-XX:+UseG1GC'],'accept'],['parallel',['-XX:+UseParallelGC'],'accept'],['serial',['-XX:+UseSerialGC'],'accept'],
  ['gc-conflict',['-XX:+UseG1GC','-XX:+UseParallelGC'],'reject'],
  ['unknown',['-XX:+PkqaFlagDoesNotExist'],'reject'],['permsize-obsolete',['-XX:PermSize=16m'],'obsolete'],
  ['date-stamps-removed',['-XX:+PrintGCDateStamps'],'reject'],['zgenerational-not-present',['-XX:+ZGenerational'],'reject'],
  ['g1-newsize-needs-unlock',['-XX:+UseG1GC','-XX:G1NewSizePercent=5'],'reject'],
  ['g1-maxnewsize-needs-unlock',['-XX:+UseG1GC','-XX:G1MaxNewSizePercent=60'],'reject'],
  ['g1-mixedlive-needs-unlock',['-XX:+UseG1GC','-XX:G1MixedGCLiveThresholdPercent=85'],'reject'],
  ['g1-oldcset-needs-unlock',['-XX:+UseG1GC','-XX:G1OldCSetRegionThresholdPercent=10'],'reject'],
  ['g1-unlock-order',['-XX:+UseG1GC','-XX:G1NewSizePercent=5','-XX:+UnlockExperimentalVMOptions'],'reject'],
  ['g1-experimental',['-XX:+UseG1GC','-XX:+UnlockExperimentalVMOptions','-XX:G1NewSizePercent=5','-XX:G1MaxNewSizePercent=60','-XX:G1MixedGCLiveThresholdPercent=85','-XX:G1OldCSetRegionThresholdPercent=10'],'accept'],
  ['g1-cross-bounds',['-XX:+UseG1GC','-XX:+UnlockExperimentalVMOptions','-XX:G1NewSizePercent=80','-XX:G1MaxNewSizePercent=20'],'reject'],
  ['gc-log',['-Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=5,filesize=10M'],'accept'],
 ];
 if(major===11) fixed.push(['cms-deprecated-but-recognized',['-XX:+UseConcMarkSweepGC'],'accept'],['aggressiveopts-deprecated-but-recognized',['-XX:+AggressiveOpts'],'accept']);
 else fixed.push(['cms-removed',['-XX:+UseConcMarkSweepGC'],'reject'],['aggressiveopts-removed',['-XX:+AggressiveOpts'],'reject'],['zgc-native-supported-product-capability-starts17',['-XX:+UseZGC'],'accept']);
 for(const [id,args,expected] of fixed) probe(id,[...prefix,...args,'-version'],expected);
 const base={version:major===16?'1.17':'1.16.5',javaVersion:major,executable:java,jar:'server.jar',platform:process.platform==='win32'?'powershell':'sh',minMemoryMiB:256,maxMemoryMiB:512,collector:'g1',selectedFlags:[],numericValues:{},nogui:true};
 function argsFor(input,id,combined=false){
  const generated=makeServerLaunch(input);assert.deepEqual(generated.errors,[],`${major}/${id}: product rejected supported profile`);
  const marker=generated.javaArgs.indexOf('-jar');assert.ok(marker>0&&generated.javaArgs[marker+1]===input.jar);
  const args=generated.javaArgs.slice(0,marker).map(arg=>/^-Xms/.test(arg)?'-Xms32m':/^-Xmx/.test(arg)?'-Xmx64m':arg);
  if(!combined&&args.some(arg=>arg.startsWith('-XX:ActiveProcessorCount='))) args.push('-XX:ParallelGCThreads=4','-XX:ConcGCThreads=1');
  return [...args,'-version'];
 }
 function flagInput(flag,value){
  const collector=flag.collector??'g1',selectedFlags=[flag.id],numericValues=value===undefined?{}:{[flag.id]:value};
  if(flag.id==='ConcGCThreads'){selectedFlags.push('ParallelGCThreads');numericValues.ParallelGCThreads=Math.max(4,value??flag.defaultValue);}
  return {...base,collector,selectedFlags,numericValues};
 }
 for(const flag of SERVER_JVM_FLAGS){
  const input=flagInput(flag),reason=flagSupportReason(flag,major,input.collector);
  if(reason){assert.ok(makeServerLaunch(input).errors.length,`${major}/${flag.id}: unsupported option must not be emitted`);counts.productGuards++;continue;}
  probe(`flag-${flag.id}-default`,argsFor(input,flag.id),'accept','defaults');
  if(flag.kind==='number') for(const [label,value] of [['min',flag.min],['max',flag.max]]){
   const bounded=flagInput(flag,value),output=makeServerLaunch(bounded);
   if(output.errors.length){assert.ok((flag.id==='G1NewSizePercent'&&label==='max')||(flag.id==='G1MaxNewSizePercent'&&label==='min'),`${major}/${flag.id}/${label}: unexpected product boundary rejection`);counts.productGuards++;continue;}
   probe(`flag-${flag.id}-${label}`,argsFor(bounded,`${flag.id}/${label}`),'accept','bounds');
  }
 }
 const cpu=probe('cpu-maximum-preserved',[...prefix,'-XX:+UseG1GC','-XX:ActiveProcessorCount=1024','-XX:ParallelGCThreads=4','-XX:ConcGCThreads=1','-XX:+PrintFlagsFinal','-version']);
 assert.match(cpu,/\bActiveProcessorCount\s+:?=\s+1024\b/);assert.match(cpu,/\bParallelGCThreads\s+:?=\s+4\b/);
 for(const collector of SERVER_GC_OPTIONS){
  if(collector.javaMin>major){assert.ok(makeServerLaunch({...base,collector:collector.id}).errors.length);counts.productGuards++;continue;}
  const selectedFlags=SERVER_JVM_FLAGS.filter(flag=>!flagSupportReason(flag,major,collector.id)&&flag.id!=='DisableExplicitGC').map(flag=>flag.id);
  probe(`collector-${collector.id}`,argsFor({...base,collector:collector.id,selectedFlags},collector.id,true),'accept','collectors');
 }
 for(const selectedFlags of [['DisableExplicitGC','ExplicitGCInvokesConcurrent'],['ConcGCThreads'],['ZGenerational'],['PrintGCDateStamps']]){assert.ok(makeServerLaunch({...base,selectedFlags}).errors.length);counts.productGuards++;}
 const report={major,java,runtime:runtime.trim(),classifierChecks,counts,probes:records.length,failures:records.filter(row=>!row.pass),records,asset:receipt?{apiUrl:receipt.apiUrl,version:receipt.asset.version.semver,link:receipt.asset.binary.package.link,sha256:receipt.sha256}:null,
 limitations:['Only this HotSpot distribution/update is executed; this validates argument acceptance, not Minecraft/plugin behavior or performance.','Every process ends with -version and uses 32/64 MiB heap; individual CPU count bounds explicitly bound G1 workers and verify that the CPU value is preserved.','Java 16 is an unmaintained historical runtime, retained here only for compatibility testing; its old patch is not a deployment recommendation.']};
 writeFileSync(join(cache,`java${major}-native-result.json`),JSON.stringify(report,null,2));reports.push(report);
 if(report.failures.length){console.error(JSON.stringify(report.failures,null,2));throw new Error(`${report.failures.length} Java ${major} JVM argument probes failed`);}
 console.log(`Java ${major} native launch audit passed: ${records.length} real -version probes`,counts);
}
writeFileSync(join(cache,requestedMajor?`java${requestedMajor}-summary.json`:'summary.json'),JSON.stringify(reports.map(({major,runtime,classifierChecks,counts,probes,failures,asset})=>({major,runtime,classifierChecks,counts,probes,failures,asset})),null,2));
