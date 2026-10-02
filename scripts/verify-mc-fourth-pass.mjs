import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTs} from './mc-test-runtime.mjs';
import {mount} from './mc-interaction-runtime.mjs';
const {MC_VERSIONS,versionAtLeast}=loadTs('../src/lib/mc/give.ts');
const {isBlockInteger,isSpawnablePosition}=loadTs('../src/lib/mc/position.ts');
let checks=0;
for(const version of MC_VERSIONS){
 const catalog=JSON.parse(readFileSync(`public/mc-data/${version}.json`,'utf8'));
 const block=mount('BlockTool',{version,catalog});
 for(const value of ['2147483648','-2147483649','9007199254740991','30000000','-30000001','1.2','NaN','Infinity','']){
  block.nodes().find(n=>n.props.label==='起点').props.onChange([value,'64','0']);assert.equal(block.commands().length,0);checks++;
 }
 for(const value of ['2147483647','-2147483648','0','-1']){
  block.nodes().find(n=>n.props.label==='起点').props.onChange(['0',value,'0']);assert.ok(block.commands().some(c=>c.startsWith('/setblock')));checks++;
 }
 block.nodes().find(n=>n.props.label==='起点').props.onChange(['0','0','0']);
 for(const [end,volume] of [[['31','31','31'],32768],[['32','31','31'],33792]]){
  block.nodes().find(n=>n.props.label==='终点').props.onChange(end);
  assert.equal(block.commands().some(c=>c.startsWith('/fill')),volume<=32768||versionAtLeast(version,'1.19.4'));assert.ok(block.commands().some(c=>c.startsWith('/setblock')));checks++;
 }
 block.unmount();
 if(versionAtLeast(version,'1.12')) {
 const summon=mount('SummonTool',{version,catalog});summon.button('指定绝对坐标').props.onClick();
 for(const [point,valid] of [[['29999999','64','-30000000'],true],[['30000000','64','0'],false],[['-30000001','64','0'],false],[['0','2147483648','0'],false],[['0','1.5','0'],false],[['0','19999999','0'],true],[['0','20000000','0'],!versionAtLeast(version,'1.13')],[['0','-20000001','0'],!versionAtLeast(version,'1.13')]]){
  point.forEach((value,i)=>summon.edit(summon.all('input').filter(n=>n.props.type==='number')[i],value));
  assert.equal(summon.commands().some(c=>c.startsWith('/summon')),valid);checks++;
 }
 summon.button('当前位置').props.onClick();assert.ok(summon.commands().some(c=>c.endsWith('~ ~ ~')));checks++;summon.unmount();
 }
 const coordinate=mount('CoordinateTool',{version});coordinate.button('下界 → 主世界').props.onClick();
 for(const [x,result,valid] of [['3749999.99',29999999,true],['3750000',30000000,false],['-3750000',-30000000,true],['-3750000.01',-30000001,false]]){
  coordinate.edit(coordinate.all('input')[0],x);coordinate.edit(coordinate.all('input')[2],'0');
  assert.equal(coordinate.commands().length,valid?1:0);assert.ok(coordinate.text().includes(result.toLocaleString('zh-CN')));
  const copy=coordinate.all('button').find(n=>n.props.className==='mc-copy-button');assert.equal(Boolean(copy.props.disabled),!valid);checks++;
 }
 coordinate.edit(coordinate.all('input')[0],'0');assert.equal(coordinate.commands().length,1);checks++;coordinate.unmount();
}
for(const [value,valid] of [[2147483647,true],[-2147483648,true],[2147483648,false],[-2147483649,false],[NaN,false],[Infinity,false],[1.5,false]]){assert.equal(isBlockInteger(value),valid);checks++;}
assert.equal(isSpawnablePosition([0,0], '26.1'),false);checks++;
console.log(`Fourth pass: ${checks} coordinate and fill boundary checks passed across all 9 versions.`);
