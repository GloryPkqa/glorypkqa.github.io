import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,join,delimiter} from 'node:path';
import {spawnSync} from 'node:child_process';
// This runner only uses codecs/command parsing. It never starts server main,
// accepts an EULA, opens a port, creates a world, or executes commands.
const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const root=resolve('.'), dest=join(root,'coverage/native26');mkdirSync(dest,{recursive:true});
const requestedJavaHome=option('--java-home')??process.env.JAVA_HOME;
const javaHome=requestedJavaHome?resolve(requestedJavaHome):undefined;
const java=name=>javaHome?join(javaHome,'bin',name+(process.platform==='win32'?'.exe':'')):name;
const run=(command,args,cwd=root)=>{const r=spawnSync(command,args,{cwd,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:10*1024*1024});if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);if(r.error)throw r.error;if(r.status!==0)throw new Error(`${command} failed (${r.status})`);};
const version=spawnSync(java('java'),['-version'],{encoding:'utf8',windowsHide:true,timeout:15000});
if(version.error||version.status!==0||!/(?:version|openjdk) "25(?:\.|"|\+)/.test(version.stderr))throw new Error('Native audit needs JDK 25; use JAVA_HOME or --java-home');
const archive=join(root,'coverage/mc-26.1-server.jar');
const expected='3872a7f07a1a595e651aef8b058dfc2bb3772f46';
if(!existsSync(archive)){
 const response=await fetch(`https://piston-data.mojang.com/v1/objects/${expected}/server.jar`,{signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw new Error(`Official server download failed: ${response.status}`);
 const contents=Buffer.from(await response.arrayBuffer());if(createHash('sha1').update(contents).digest('hex')!==expected)throw new Error('Official server checksum mismatch');writeFileSync(archive,contents);
}
if(createHash('sha1').update(readFileSync(archive)).digest('hex')!==expected)throw new Error('Cached official server checksum mismatch');
run(option('--python')??(process.platform==='win32'?'python':'python3'),['scripts/extract-mc-native.py',archive,dest]);
run(process.execPath,['scripts/verify-mc-native-data.mjs']);
run(process.execPath,['scripts/generate-mc-native-fixtures.mjs']);
const jars=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?jars(join(directory,e.name)):e.name.endsWith('.jar')?[join(directory,e.name)]:[]);
const classpath=[dest,...jars(dest)].join(delimiter);
run(java('javac'),['-encoding','UTF-8','-cp',classpath,'-d',dest,'scripts/NativeMcAudit.java']);
const result=join(root,'coverage/native26-result.json');
run(java('java'),['-Xmx1G','-cp',classpath,'NativeMcAudit',join(root,'coverage/native26-cases.json'),result],dest);
const parsed=JSON.parse(readFileSync(result,'utf8'));
if(parsed.failures.length){console.error(JSON.stringify(parsed.failures,null,2));throw new Error(`${parsed.failures.length} official parser checks failed`);}
console.log('Official Minecraft 26.1 audit passed:',parsed.counts);
