import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Offline parser/data-object audit only. Does not invoke server main, execute
// commands, accept an EULA, create a world, bind sockets, or modify the OS.
const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const root=fileURLToPath(new URL('../',import.meta.url)), dest=join(root,'coverage/legacy116');
mkdirSync(dest,{recursive:true});
const requestedJavaHome=option('--java-home')??process.env.JAVA_HOME;
const javaHome=requestedJavaHome?resolve(requestedJavaHome):undefined;
const java=name=>javaHome?join(javaHome,'bin',name+(process.platform==='win32'?'.exe':'')):name;
const timeoutMs=120_000;
const run=(command,args,cwd=root)=>{
 const result=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:10*1024*1024,timeout:timeoutMs});
 if(result.stdout) process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
 if(result.error?.code==='ETIMEDOUT') throw new Error(`${command} exceeded the 120-second offline audit timeout`,{cause:result.error});
 if(result.error) throw result.error; if(result.status!==0) throw new Error(`${command} exited ${result.status}`);
};
const sha=bytes=>createHash('sha1').update(bytes).digest('hex');
const fetchBytes=async url=>{
 const response=await fetch(url,{signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok) throw new Error(`Official download ${response.status}: ${url}`);
 return Buffer.from(await response.arrayBuffer());
};
const cached=async(name,url,expected,size)=>{
 const path=join(dest,name),bytes=existsSync(path)?readFileSync(path):await fetchBytes(url);
 if(expected && sha(bytes)!==expected || size!==undefined && bytes.length!==size) throw new Error(`Official SHA-1/size mismatch: ${name}`);
 if(!existsSync(path)) writeFileSync(path,bytes);return bytes;
};
const manifestUrl='https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const manifest=JSON.parse(await cached('manifest.json',manifestUrl));
const entry=manifest.versions.find(v=>v.id==='1.16.5');
if(!entry || entry.sha1!=='fba9f7833e858a1257d810d21a3a9e3c967f9077' || entry.url!=='https://piston-meta.mojang.com/v1/packages/fba9f7833e858a1257d810d21a3a9e3c967f9077/1.16.5.json') throw new Error('Pinned 1.16.5 official manifest identity mismatch');
const metadata=JSON.parse(await cached('metadata.json',entry.url,entry.sha1));
const downloads=[];
for(const [key,name,pin] of [['server','server-1.16.5.jar','1b557e7b033b583cd9f66746b7a9ab1ec1673ced'],['server_mappings','server-mappings-1.16.5.txt','41285beda6d251d190f2bf33beadd4fee187df7a']]) {
 const expected=metadata.downloads[key]; if(expected.sha1!==pin || new URL(expected.url).hostname!=='piston-data.mojang.com') throw new Error(`Pinned official ${key} identity mismatch`);
 await cached(name,expected.url,pin,expected.size);downloads.push({key,path:join(dest,name),...expected});
}
writeFileSync(join(dest,'evidence.json'),JSON.stringify({id:'1.16.5',manifestUrl,metadataUrl:entry.url,metadataSha1:entry.sha1,downloads},null,2));
run(process.execPath,[join(root,'scripts/generate-mc-legacy116-native-fixtures.mjs')]);
const archive=join(dest,'server-1.16.5.jar');
run(java('javac'),['-encoding','UTF-8','-cp',archive,'-d',dest,join(root,'scripts/Legacy116ParserAudit.java')]);
run(java('java'),['-Xms32m','-Xmx512m','-cp',[dest,archive].join(delimiter),'Legacy116ParserAudit',join(dest,'cases.json'),join(dest,'results.json')],dest);
const result=JSON.parse(readFileSync(join(dest,'results.json'),'utf8'));
const counts={};for(const row of result.rows) counts[row.kind]=(counts[row.kind]??0)+1;
const failures=result.rows.filter(row=>!row.matches);
const summary={minecraft:'1.16.5',javaVersion:result.javaVersion,mode:result.mode,total:result.rows.length,counts,failures,officialEvidence:join(dest,'evidence.json'),results:join(dest,'results.json')};
writeFileSync(join(dest,'summary.json'),JSON.stringify(summary,null,2));
if(failures.length) { console.error(JSON.stringify(failures,null,2));throw new Error(`${failures.length} old-version official parser/semantic checks failed`); }
console.log('Official Minecraft 1.16.5 offline audit passed:',JSON.stringify({javaVersion:summary.javaVersion,total:summary.total,counts}));
