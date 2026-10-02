import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {loadTs} from './mc-test-runtime.mjs';
import {mount,flush,respond} from './mc-interaction-runtime.mjs';
const {MC_VERSIONS,versionAtLeast}=loadTs('../src/lib/mc/give.ts');
const {characters,defaultTextStyle,remapTextColors}=loadTs('../src/lib/mc/textColors.ts');
const catalogs=Object.fromEntries(MC_VERSIONS.map(v=>[v,JSON.parse(readFileSync(`public/mc-data/${v}.json`,'utf8'))]));
const counts={paintEdits:0,copyFailures:0,downloads:0,navigation:0};
const controls=(ui,label)=>ui.nodes().find(n=>n.props.label===label&&n.props.onChange);
const edits=[['AB','XAB',{1:'#FF5555'},{2:'#FF5555'}],['ABC','AC',{1:'#FF5555',2:'#55FFFF'},{1:'#55FFFF'}],['ABC','ABXC',{0:'#FF5555',2:'#55FFFF'},{0:'#FF5555',3:'#55FFFF'}],['ABC','AXC',{1:'#FF5555',2:'#55FFFF'},{2:'#55FFFF'}],['ABC','XYZ',{1:'#FF5555'},{}],['🐈‍⬛é🇨🇳','X🐈‍⬛é🇨🇳',{0:'#FF5555',2:'#55FFFF'},{1:'#FF5555',3:'#55FFFF'}],[' A ','X A ',{1:'#FF5555'},{2:'#FF5555'}],['ABC','ABC',{0:'#FF5555',2:'#55FFFF'},{0:'#FF5555',2:'#55FFFF'}],['ABC','',{0:'#FF5555'},{}],['','中文',{0:'#FF5555'},{}]];
for(const [before,after,overrides,expected] of edits){assert.deepEqual(remapTextColors(before,after,overrides),expected);counts.paintEdits++;}
const caretEdits=[['AA','AAA',1,{0:'#FF5555',1:'#55FFFF'},{1:'#FF5555',2:'#55FFFF'}],['AA','AAA',2,{0:'#FF5555',1:'#55FFFF'},{0:'#FF5555',2:'#55FFFF'}],['AA','AAA',3,{0:'#FF5555',1:'#55FFFF'},{0:'#FF5555',1:'#55FFFF'}],['AAA','AA',0,{0:'#FF5555',1:'#55FFFF'},{0:'#55FFFF'}],['AAA','AA',1,{0:'#FF5555',1:'#55FFFF',2:'#FFFF55'},{0:'#FF5555',1:'#FFFF55'}],['🐈‍⬛🐈‍⬛','🐈‍⬛🐈‍⬛🐈‍⬛','🐈‍⬛'.length,{0:'#FF5555',1:'#55FFFF'},{1:'#FF5555',2:'#55FFFF'}],['中文文','中文文文',2,{2:'#FF5555'},{3:'#FF5555'}],['AB','XAB',-1,{1:'#FF5555'},{2:'#FF5555'}],['AB','XAB',999,{1:'#FF5555'},{2:'#FF5555'}]];
for(const [before,after,caret,overrides,expected] of caretEdits){assert.deepEqual(remapTextColors(before,after,overrides,caret),expected);counts.paintEdits++;}
for(const version of MC_VERSIONS){
 for(const tool of ['ColorTool','TitleTool']){
  const ui=mount(tool,{version});const channels=tool==='ColorTool'?['聊天文字']:versionAtLeast(version,'1.16')?['主标题','副标题','操作栏']:['主标题','副标题'];
  for(const [channelIndex,label] of channels.entries())for(const [before,after,overrides,expected] of edits){
   if(tool==='TitleTool')ui.button(label).props.onClick();
   const input=()=>tool==='ColorTool'?ui.all('textarea')[0]:ui.all('input')[channelIndex];
   ui.edit(input(),before);const c=controls(ui,label);c.props.onChange({...defaultTextStyle(),mode:'manual',overrides});ui.edit(input(),after);
   assert.deepEqual(controls(ui,label).props.style.overrides,expected,`${version}/${tool}/${label}/${before}->${after}`);
   const unchanged=controls(ui,label).props.style.overrides;for(const i of Object.keys(unchanged))assert.ok(Number(i)<characters(after).length);counts.paintEdits++;
  }
  for(const [channelIndex,label] of channels.entries())for(const [before,after,caret,overrides,expected] of caretEdits){
   if(tool==='TitleTool')ui.button(label).props.onClick();
   const input=()=>tool==='ColorTool'?ui.all('textarea')[0]:ui.all('input')[channelIndex];
   ui.edit(input(),before);controls(ui,label).props.onChange({...defaultTextStyle(),mode:'manual',overrides});input().props.onChange({target:{value:after,selectionStart:caret}});
   assert.deepEqual(controls(ui,label).props.style.overrides,expected,`${version}/${tool}/${label}/caret-${caret}`);counts.paintEdits++;
  }
  ui.unmount();
 }
}
const clipboard=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:value=>new Promise((resolve,reject)=>clipboard.push({value,resolve,reject}))}}});
const fixtures=[['ColorTool',{},ui=>ui.edit(ui.all('textarea')[0],'changed')],['TitleTool',{},ui=>ui.edit(ui.all('input').find(n=>n.props.type==='number'),'1')],['CoordinateTool',{},ui=>ui.edit(ui.all('input')[0],'1600')],['BlockTool',{},ui=>ui.edit(ui.all('input')[0],'dirt')],['SummonTool',{},ui=>ui.edit(ui.all('input')[0],'creeper')],['WorldTool',{},ui=>ui.edit(ui.all('input')[0],'6000')],['EffectTool',{},ui=>ui.edit(ui.all('select')[0],'strength')]];
for(const version of MC_VERSIONS)for(const [tool,props,change] of fixtures){
 if(tool==='SummonTool'&&!versionAtLeast(version,'1.12'))continue;
 const ui=mount(tool,{version,catalog:catalogs[version],...props});const button=()=>ui.all('button').find(n=>n.props.className==='mc-copy-button');
 button().props.onClick();clipboard.at(-1).reject(new Error('denied'));await flush();assert.match(button().props.children,/复制失败/);counts.copyFailures++;
 change(ui);assert.doesNotMatch(button().props.children,/复制失败/,`${version}/${tool}: changed command`);counts.copyFailures++;
 button().props.onClick();const stale=clipboard.at(-1);button().props.onClick();clipboard.at(-1).resolve();await flush();stale.reject(new Error('old denial'));await flush();assert.equal(button().props.children,'已复制 ✓');counts.copyFailures++;
 button().props.onClick();clipboard.at(-1).reject(new Error('denied'));await flush();assert.match(button().props.children,/手动复制/);counts.copyFailures++;
 button().props.onClick();clipboard.at(-1).resolve();await flush();assert.equal(button().props.children,'已复制 ✓');counts.copyFailures++;ui.unmount();
}
const player=mount('PlayerLookup');player.tick(0);respond(player.requests[0],{data:{player:{username:'Pkqa',id:'pkqa-uuid'}}});await flush();
player.button('复制 UUID').props.onClick();clipboard.at(-1).reject(new Error('denied'));await flush();assert.match(player.all('button').at(-1).props.children,/复制失败/);counts.copyFailures++;player.unmount();
const blobs=new Map(),revoked=[],links=[];let urlId=0,failDownload=false;
URL.createObjectURL=blob=>{if(failDownload)throw new Error('blocked');const url=`blob:test-${++urlId}`;blobs.set(url,blob);return url;};URL.revokeObjectURL=url=>revoked.push(url);
globalThis.document={body:{append(){}},createElement(){const link={click(){links.push({url:this.href,name:this.download})},remove(){}};return link;}};
mkdirSync('coverage/fifth-downloads',{recursive:true});
for(const version of MC_VERSIONS.filter(v=>versionAtLeast(v,'1.16'))){
 const ui=mount('DataPackTool',{version,catalog:catalogs[version]});const button=()=>ui.all('button').find(n=>n.props.className==='mc-copy-button');
 button().props.onClick();assert.equal(button().props.children,'ZIP 已准备下载 ✓');counts.downloads++;
 const oldTimer=[...ui.timers.values()].find(t=>t.delay===2000).callback;
 ui.edit(ui.all('input')[1],'edited');assert.equal(button().props.children,'下载数据包 ZIP ↓');counts.downloads++;
 button().props.onClick();const latest=links.at(-1);assert.equal(latest.name,`edited-${version.replaceAll('.','_')}-datapack.zip`);oldTimer();assert.equal(button().props.children,'ZIP 已准备下载 ✓');counts.downloads++;
 writeFileSync(`coverage/fifth-downloads/${version}.zip`,Buffer.from(await blobs.get(latest.url).arrayBuffer()));
 ui.tick(2000);assert.equal(button().props.children,'下载数据包 ZIP ↓');counts.downloads++;
 failDownload=true;assert.doesNotThrow(()=>button().props.onClick());assert.match(ui.text(),/下载准备失败/);assert.equal(button().props.children,'下载数据包 ZIP ↓');counts.downloads++;
 failDownload=false;button().props.onClick();assert.doesNotMatch(ui.text(),/下载准备失败/);assert.equal(button().props.children,'ZIP 已准备下载 ✓');counts.downloads++;
 ui.tick(60000);assert.equal([...ui.timers.values()].filter(t=>t.delay===60000).length,0);counts.downloads++;
 button().props.onClick();const lastUrl=links.at(-1).url;ui.unmount();assert.ok(revoked.includes(lastUrl));assert.equal(ui.timers.size,0);counts.downloads++;
}
const history=[],scrolls=[];globalThis.document={getElementById:id=>({scrollIntoView:options=>scrolls.push({id,...options})})};
const setupWindow=win=>{win.history={pushState:(_,__,hash)=>history.push(hash)};win.matchMedia=()=>({matches:true});win.scrollTo=options=>scrolls.push(options);win.scrollY=900;win.addEventListener=()=>{};win.removeEventListener=()=>{};};
let prevented=0;const event={button:0,preventDefault(){prevented++;}};
const start=mount('McWorkbench',{href:'#give'},{exportName:'CraftStartButton',setupWindow});
for(const modifier of ['ctrlKey','metaKey','shiftKey','altKey']){start.all('a')[0].props.onClick({...event,[modifier]:true});assert.equal(prevented,0);assert.equal(start.timers.size,0);counts.navigation++;}
start.all('a')[0].props.onClick(event);start.all('a')[0].props.onClick(event);assert.equal(start.timers.size,2);counts.navigation++;
start.tick(300);assert.deepEqual(history,['#give']);assert.equal(scrolls[0].behavior,'instant');counts.navigation++;
start.tick(850);start.all('a')[0].props.onClick(event);start.unmount();assert.equal(start.timers.size,0);start.tick(300);assert.equal(history.length,1);counts.navigation++;
const quick=mount('McWorkbench',{}, {exportName:'QuickReturn',setupWindow});
for(const a of quick.all('a'))for(const modifier of ['ctrlKey','metaKey','shiftKey','altKey']){const before=prevented;a.props.onClick({...event,[modifier]:true});assert.equal(prevented,before);counts.navigation++;}
quick.all('a')[1].props.onClick(event);assert.equal(history.at(-1),'#mc-directory-heading');counts.navigation++;quick.unmount();
console.log('Fifth pass passed:',JSON.stringify(counts),'total',Object.values(counts).reduce((a,b)=>a+b,0));
