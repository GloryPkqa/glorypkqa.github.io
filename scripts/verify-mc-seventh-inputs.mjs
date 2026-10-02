import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mount} from './mc-interaction-runtime.mjs';
import {loadTs} from './mc-test-runtime.mjs';

const {MC_VERSIONS,versionAtLeast}=loadTs('../src/lib/mc/give.ts');
const counts={portalInputs:0,routeRecovery:0,blockBounds:0,fillVolume:0,clock:0,worldRecovery:0};
const copyButtons=ui=>ui.all('button').filter(node=>node.props.className==='mc-copy-button');

for(const version of MC_VERSIONS){
  const route=mount('CoordinateTool',{version});
  for(const reverse of [false,true]){
    route.button(reverse?'下界 → 主世界':'主世界 → 下界').props.onClick();
    for(const [point,expected] of [
      [['0','64','0'],reverse?'0 64 0':'0 64 0'],
      [['-8.01','-0.1','7.99'],reverse?'-65 -1 63':'-2 -1 0'],
      [['0.125','64.9','-0.125'],reverse?'1 64 -1':'0 64 -1'],
    ]){
      point.forEach((value,index)=>route.edit(route.all('input')[index],value));
      assert.equal(route.commands()[0],`/tp ${version==='1.8.9'?'@p':'@s'} ${expected}`);
      counts.portalInputs++;
    }
    for(const bad of ['', 'Infinity', 'NaN', '1e308', '--1'])for(const axis of [0,1,2]){
      ['0','64','0'].forEach((value,index)=>route.edit(route.all('input')[index],value));
      route.edit(route.all('input')[axis],bad);
      assert.equal(route.commands().length,0);assert.ok(!copyButtons(route)[0]||copyButtons(route)[0].props.disabled);
      route.edit(route.all('input')[axis],axis===1?'64':'0');
      assert.equal(route.commands().length,1);assert.equal(copyButtons(route)[0].props.disabled,false);
      counts.portalInputs++;
    }
  }
  ['0','0','0','3','4','12'].forEach((value,index)=>route.edit(route.all('input')[index],value));
  assert.match(route.text(),/13\.0/);assert.match(route.text(),/12\.4/);counts.routeRecovery++;
  for(const index of [3,4,5]){
    const before=route.all('input')[index].props.value;
    route.edit(route.all('input')[index],'');assert.match(route.text(),/都填完整/);assert.doesNotMatch(route.text(),/水平距离/);assert.equal(route.commands().length,1);
    route.edit(route.all('input')[index],before);assert.match(route.text(),/水平距离/);counts.routeRecovery++;
  }
  [3,4,5].forEach(index=>route.edit(route.all('input')[index],''));assert.doesNotMatch(route.text(),/都填完整/);counts.routeRecovery++;route.unmount();

  const catalog=JSON.parse(readFileSync(`public/mc-data/${version}.json`,'utf8'));
  const block=mount('BlockTool',{version,catalog});
  const point=(label,values)=>block.nodes().find(node=>node.props.label===label).props.onChange(values);
  for(const label of ['起点','终点'])for(const axis of [0,1,2])for(const [value,valid] of axis===1?
    [['-2147483648',true],['2147483647',true],['-2147483649',false],['2147483648',false],['1.5',false],['',false]]:
    [['-30000000',true],['29999999',true],['-30000001',false],['30000000',false],['1.5',false],['',false]]){
    point('起点',['0','64','0']);point('终点',['0','64','0']);const values=['0','64','0'];values[axis]=value;point(label,values);
    assert.equal(block.commands().some(command=>command.startsWith('/setblock')),label==='终点'||valid);
    assert.equal(block.commands().some(command=>command.startsWith('/fill')),valid&& (versionAtLeast(version,'1.19.4')||Number(value)===64||Math.abs(Number(value))+1<=32768));
    counts.blockBounds++;
  }
  for(const [from,to,volume] of [
    [['0','0','0'],['31','31','31'],32768],
    [['31','31','31'],['0','0','0'],32768],
    [['0','0','0'],['32','31','31'],33792],
    [['-31','-31','-31'],['0','0','0'],32768],
    [['-30000000','-2147483648','-30000000'],['29999999','2147483647','29999999'],null],
  ]){
    point('起点',from);point('终点',to);
    assert.equal(block.commands().some(command=>command.startsWith('/fill')),volume!==null&&(volume<=32768||versionAtLeast(version,'1.19.4')));
    assert.equal(copyButtons(block)[1].props.disabled,volume===null||(volume>32768&&!versionAtLeast(version,'1.19.4')));
    assert.ok(block.commands().some(command=>command.startsWith('/setblock')));counts.fillVolume++;
  }
  block.unmount();
}

// Exhaust the finite day rather than sampling only whole game hours. The
// independent oracle advances minutes at their ceil(minute * 1000/60) boundary.
const world=mount('WorldTool');let elapsedMinutes=0;
for(let ticks=0;ticks<24000;ticks++){
  while(ticks>=Math.ceil((elapsedMinutes+1)*1000/60))elapsedMinutes++;
  const minutes=(elapsedMinutes+360)%1440;
  const expected=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  world.edit(world.all('input')[0],String(ticks));
  assert.equal(world.nodes().find(node=>node.props.className==='mc-world-preview').props.children[1].props.children,expected);
  counts.clock++;
}
for(const bad of ['','-1','24000','0.5','1e3','NaN','Infinity','0x10']){
  world.edit(world.all('input')[0],bad);
  assert.equal(world.commands().some(command=>command.startsWith('/time')),false);
  assert.equal(copyButtons(world)[0].props.disabled,true);
  assert.deepEqual(world.commands(),['/weather clear','/difficulty normal']);
  world.button('日出').props.onClick();assert.equal(world.commands()[0],'/time set 0');counts.worldRecovery++;
}
for(const [label,id] of [['晴朗','clear'],['降雨','rain'],['雷暴','thunder']])for(const difficulty of ['peaceful','easy','normal','hard']){
  world.button(label).props.onClick();world.edit(world.all('select')[0],difficulty);
  assert.ok(world.commands().includes(`/weather ${id}`));assert.ok(world.commands().includes(`/difficulty ${difficulty}`));counts.worldRecovery++;
}
world.unmount();
console.log('Seventh input checks passed:',JSON.stringify(counts),'total',Object.values(counts).reduce((a,b)=>a+b,0));
