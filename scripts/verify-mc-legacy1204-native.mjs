import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';

// Official offline parsing/serialization only. This runner never invokes
// MinecraftServer main, accepts EULA, opens a port, creates a world, or executes
// parsed commands. All Java process working directories stay in the coverage
// namespace, including bootstrap/log4j output.
const option=name=>{const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];};
const root=resolve('.'), directory=join(root,'coverage/legacy1204');
mkdirSync(directory,{recursive:true});
const sha1=buffer=>createHash('sha1').update(buffer).digest('hex');
const versionArtifact={name:'1.20.4.json',sha1:'bff1278922bca138b7722385a81366f3077abffa',url:'https://piston-meta.mojang.com/v1/packages/bff1278922bca138b7722385a81366f3077abffa/1.20.4.json'};
const serverArtifact={name:'official-server.jar',sha1:'8dd1a28015f51b1803213892b50b7b4fc76e594d',url:'https://piston-data.mojang.com/v1/objects/8dd1a28015f51b1803213892b50b7b4fc76e594d/server.jar'};
const mappingsArtifact={name:'server-mappings.txt',sha1:'c1cafe916dd8b58ed1fe0564fc8f786885224e62',url:'https://piston-data.mojang.com/v1/objects/c1cafe916dd8b58ed1fe0564fc8f786885224e62/server.txt'};
for(const artifact of [versionArtifact,serverArtifact,mappingsArtifact]) {
  const path=join(directory,artifact.name);
  if(!existsSync(path)) {
    if(!process.argv.includes('--download'))throw Error(`Missing official artifact ${artifact.name}; rerun with --download to fetch from Mojang.`);
    const response=await fetch(artifact.url,{signal:AbortSignal.timeout(90_000)});
    if(!response.ok)throw Error(`Official download failed (${response.status})`);
    const buffer=Buffer.from(await response.arrayBuffer());
    if(sha1(buffer)!==artifact.sha1)throw Error(`Official ${artifact.name} checksum mismatch`);
    writeFileSync(path,buffer);
  }
  if(sha1(readFileSync(path))!==artifact.sha1)throw Error(`Cached official ${artifact.name} checksum mismatch`);
}
const metadata=JSON.parse(readFileSync(join(directory,versionArtifact.name),'utf8'));
if(metadata.id!=='1.20.4'||metadata.downloads.server.sha1!==serverArtifact.sha1||metadata.downloads.server_mappings.sha1!==mappingsArtifact.sha1)throw Error('Official version/artifact metadata does not match pinned evidence');
const javaHome=resolve(root,option('--java-home')??process.env.JAVA_HOME??join(root,'coverage/java25/jdk-25.0.4.1+1'));
const java=name=>join(javaHome,'bin',`${name}${process.platform==='win32'?'.exe':''}`);
const run=(command,args,cwd=directory)=>{
  const result=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:4*1024*1024,timeout:180_000});
  if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
  if(result.error)throw result.error;if(result.status!==0)throw Error(`Offline legacy audit process failed (${result.status})`);
  return result;
};
const javaVersion=run(java('java'),['-version']);
const versionText=javaVersion.stdout+javaVersion.stderr;
const javaMajor=Number(versionText.match(/(?:version|openjdk)\s+"(\d+)(?:[.+-][^"]*)?"/)?.[1]);
if(!Number.isInteger(javaMajor)||javaMajor<17||javaMajor>25)throw Error('Use an existing JDK 17–25 for the official 1.20.4 offline probe; no JDK is installed by this runner.');
run(option('--python')??(process.platform==='win32'?'python':'python3'),[join(root,'scripts/extract-mc-legacy1204.py'),directory]);
run(process.execPath,[join(root,'scripts/generate-mc-legacy1204-native.mjs')],root);
const jars=path=>readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?jars(join(path,entry.name)):entry.name.endsWith('.jar')?[join(path,entry.name)]:[]);
const classpath=[directory,...jars(join(directory,'runtime'))].join(delimiter);
run(java('javac'),['-encoding','UTF-8','-cp',classpath,'-d',directory,join(root,'scripts/Legacy1204OfflineProbe.java')]);
run(java('java'),['-Xmx1G','-cp',classpath,'legacy1204audit.Legacy1204OfflineProbe',join(directory,'server-mappings.txt'),join(directory,'cases.json'),join(directory,'result.json')]);
const bytecode=spawnSync(java('javap'),['-cp',classpath,'-c','-p','bli'],{cwd:directory,encoding:'utf8',maxBuffer:2*1024*1024,timeout:30_000});
if(bytecode.error||bytecode.status!==0)throw Error('Unable to capture official MobEffectInstance bytecode evidence');
writeFileSync(join(directory,'mob-effect-instance-bytecode.txt'),bytecode.stdout);
writeFileSync(join(directory,'source-evidence.json'),JSON.stringify({version:'1.20.4',javaMajor:metadata.javaVersion.majorVersion,javaUsed:versionText.trim(),versionManifest:versionArtifact,server:serverArtifact,mappings:mappingsArtifact,amplifierFixSource:'https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-5',scope:'Offline codecs, command parsing and item property inspection only; no server main, world, port, EULA or command execution.'},null,2));
const result=JSON.parse(readFileSync(join(directory,'result.json'),'utf8'));
if(result.failures.length){console.error(JSON.stringify(result.failures.slice(0,10),null,2));throw Error(`${result.failures.length} official 1.20.4 checks failed`);}
console.log('Official Minecraft 1.20.4 offline audit passed:',result.counts,'total',Object.values(result.counts).reduce((sum,value)=>sum+value,0));
