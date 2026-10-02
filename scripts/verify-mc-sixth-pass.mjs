import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mount,flush} from './mc-interaction-runtime.mjs';
import {loadTs} from './mc-test-runtime.mjs';
const {MC_VERSIONS,versionAtLeast,makeGiveCommand}=loadTs('../src/lib/mc/give.ts');
const {coloredParts,defaultTextStyle,previewTextParts,textComponent}=loadTs('../src/lib/mc/textColors.ts');
const catalogs=Object.fromEntries(MC_VERSIONS.map(v=>[v,JSON.parse(readFileSync(`public/mc-data/${v}.json`,'utf8'))]));
const supported=MC_VERSIONS.filter(v=>versionAtLeast(v,'1.16'));
const counts={search:0,numericEditing:0,confirmedImports:0,bannerFeedback:0,previewColors:0};
const numbers=ui=>ui.all('input').filter(n=>n.props.type==='number');
const disabledCopy=ui=>ui.all('button').find(n=>n.props.className==='mc-copy-button').props.disabled;
const browserItems=ui=>ui.nodes().find(n=>n.props.className==='mc-recipe-browser').props.children.map(n=>n.key);
for(const version of supported){
 const catalog=catalogs[version],recipe=mount('RecipeTool',{version,catalog});
 for(const id of ['diamond_pickaxe','diamond_sword','crafting_table','chest','oak_planks'])for(const query of [id,`minecraft:${id}`,`  MINECRAFT:${id.toUpperCase()}  `]){
  recipe.edit(recipe.all('input')[0],query);assert.ok(browserItems(recipe).includes(id),`${version}/${query}`);counts.search++;
 }
 recipe.edit(recipe.all('input')[0],'minecraft:not_an_item');assert.equal(browserItems(recipe).length,0);counts.search++;recipe.unmount();
 const process=mount('ProcessingRecipeTool',{version,catalog});process.button('酿造').props.onClick();
 for(const id of ['nether_wart','fermented_spider_eye','blaze_powder','glistering_melon_slice','magma_cream','golden_carrot','pufferfish','spider_eye','ghast_tear','rabbit_foot','phantom_membrane'])for(const query of [id,`minecraft:${id}`,`  MINECRAFT:${id.toUpperCase()}  `]){
  process.edit(process.all('input')[0],query);assert.doesNotMatch(process.text(),/没有匹配配方/,`${version}/${query}`);counts.search++;
 }
 for(const [station,type] of [['熔炼','smelting'],['切石','stonecutting'],['锻造','smithing_transform']]){
  process.button(station).props.onClick();const entry=catalog.processingRecipes.find(r=>r.type===type);assert.ok(entry);
  const raw=entry.ingredient??entry.addition;const id=(Array.isArray(raw)?raw[0]:raw).replace(/^minecraft:/,'');
  for(const query of [id,id.startsWith('#')?id:`minecraft:${id}`]){process.edit(process.all('input')[0],query);assert.doesNotMatch(process.text(),/没有匹配配方/,`${version}/${station}/${query}`);counts.search++;}
 }
 process.unmount();
}
for(const version of MC_VERSIONS){
 const ui=mount('EffectTool',{catalog:catalogs[version]});
 for(const [index,value] of [[0,'1200'],[1,'12']]){ui.edit(numbers(ui)[index],'');assert.equal(numbers(ui)[index].props.value,'');assert.equal(ui.commands().length,0);assert.equal(disabledCopy(ui),true);assert.match(ui.text(),/请填写完整/);counts.numericEditing++;
  ui.edit(numbers(ui)[index],value);assert.ok(ui.commands()[0]);assert.equal(disabledCopy(ui),false);counts.numericEditing++;
 }
 ui.edit(ui.all('input').find(n=>n.props.type==='checkbox'),true);
 for(const index of [0,1,2,3]){const replacement=index%2?'12':'1200';ui.edit(numbers(ui)[index],'');assert.equal(numbers(ui)[index].props.value,'');assert.equal(ui.commands().length,0);assert.equal(disabledCopy(ui),true);counts.numericEditing++;
  ui.edit(numbers(ui)[index],replacement);assert.equal(numbers(ui)[index].props.value,Number(replacement));assert.ok(ui.commands()[0]);counts.numericEditing++;
 }
 ui.unmount();
}
const pendingEffect=mount('EffectTool',{catalog:catalogs['26.1']});pendingEffect.edit(pendingEffect.all('input').find(n=>n.props.type==='checkbox'),true);
const exclusive=catalogs['26.1'].effects.find(e=>!catalogs['1.8.9'].effects.some(old=>old.name===e.name));assert.ok(exclusive);
pendingEffect.edit(pendingEffect.all('select')[0],exclusive.name);pendingEffect.edit(numbers(pendingEffect)[0],'');pendingEffect.props({catalog:catalogs['1.8.9']});assert.ok(pendingEffect.commands()[0]);counts.numericEditing++;
pendingEffect.props({catalog:catalogs['26.1']});assert.equal(pendingEffect.commands().length,0);assert.equal(numbers(pendingEffect)[0].props.value,'');counts.numericEditing++;pendingEffect.unmount();
const recipeOutput=ui=>JSON.parse(ui.all('code')[0].props.children).result;
for(const version of supported.filter(v=>versionAtLeast(v,'1.20.5'))){
 const ui=mount('DataPackTool',{version,catalog:catalogs[version]});
 const command=makeGiveCommand({version,item:'diamond_sword',count:2,target:'@p',name:'已确认的剑',lore:['描述'],enchantments:[{name:'sharpness',level:5}],unbreakable:true});
 ui.edit(ui.all('textarea')[0],command);ui.button('导入 /give').props.onClick();const confirmed=recipeOutput(ui);assert.equal(confirmed.count,2);assert.equal(Object.keys(confirmed.components).length,4);counts.confirmedImports++;
 ui.edit(ui.all('input').find(n=>n.props.value==='lucky_diamond'),'  lucky_diamond  ');ui.button('导入 /give').props.onClick();assert.deepEqual(recipeOutput(ui),confirmed);assert.ok(ui.all('select').find(n=>n.props.value?.endsWith('/lucky_diamond.json')));counts.confirmedImports++;
 ui.edit(ui.all('textarea')[0],command+'x');assert.deepEqual(recipeOutput(ui),confirmed);assert.match(ui.text(),/尚未重新导入/);counts.confirmedImports++;
 ui.button('导入 /give').props.onClick();assert.deepEqual(recipeOutput(ui),confirmed);assert.ok(ui.all('p').some(n=>n.props.role==='alert'));counts.confirmedImports++;
 ui.edit(ui.all('textarea')[0],command);ui.button('导入 /give').props.onClick();assert.deepEqual(recipeOutput(ui),confirmed);assert.doesNotMatch(ui.text(),/尚未重新导入/);counts.confirmedImports++;
 ui.props({version:'1.16.5',catalog:catalogs['1.16.5']});assert.match(ui.text(),/原有属性不会写入/);counts.confirmedImports++;
 ui.props({version,catalog:catalogs[version]});assert.deepEqual(recipeOutput(ui),confirmed);counts.confirmedImports++;
 ui.button('清除导入').props.onClick();assert.equal(recipeOutput(ui).components,undefined);assert.doesNotMatch(ui.text(),/属性已写入/);counts.confirmedImports++;
 ui.unmount();
}
const clipboard=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:value=>new Promise((resolve,reject)=>clipboard.push({value,resolve,reject}))}}});
for(const version of supported){
 const ui=mount('BannerTool',{version});ui.button('复制旗帜').props.onClick();clipboard.at(-1).reject(Error('denied'));await flush();assert.match(ui.text(),/复制失败/);counts.bannerFeedback++;
 ui.all('button').find(n=>n.props['aria-label']==='底色 白色').props.onClick();assert.doesNotMatch(ui.text(),/复制失败/);counts.bannerFeedback++;
 ui.button('复制旗帜').props.onClick();const previous=clipboard.at(-1);ui.all('button').find(n=>n.props['aria-label']==='底色 黑色').props.onClick();ui.button('复制旗帜').props.onClick();clipboard.at(-1).resolve();await flush();previous.reject(Error('old'));await flush();assert.doesNotMatch(ui.text(),/复制失败/);assert.match(ui.text(),/已复制/);counts.bannerFeedback++;
 ui.unmount();
}
const palette={black:'#000000',dark_blue:'#0000AA',dark_green:'#00AA00',dark_aqua:'#00AAAA',dark_red:'#AA0000',dark_purple:'#AA00AA',gold:'#FFAA00',gray:'#AAAAAA',dark_gray:'#555555',blue:'#5555FF',green:'#55FF55',aqua:'#55FFFF',red:'#FF5555',light_purple:'#FF55FF',yellow:'#FFFF55',white:'#FFFFFF'};
const control=(ui,label)=>ui.nodes().find(n=>n.props.label===label&&n.props.onChange);
const spanColors=(ui,container)=>{const root=ui.nodes().find(n=>n.props.className===container);function visit(n){if(Array.isArray(n))return n.flatMap(visit);return n?.props?[...(n.props.style?.color?[n.props.style.color]:[]),...visit(n.props.children)]:[]}return visit(root)};
for(const version of MC_VERSIONS){
 const old=!versionAtLeast(version,'1.16');
 for(const hex of Object.values(palette)){const parts=coloredParts('中文 MC',defaultTextStyle(hex));assert.equal(previewTextParts(parts,version)[0].color,hex);counts.previewColors++;}
 for(const tool of ['ColorTool','TitleTool']){
  const ui=mount(tool,{version});const labels=tool==='ColorTool'?['聊天文字']:old?['主标题','副标题']:['主标题','副标题','操作栏'];
  for(const label of labels){if(tool==='TitleTool')ui.button(label).props.onClick();
   for(const mode of ['solid','gradient','alternate','manual'])for(const colorA of ['#F09015','#123456','#55FF55','#FF5555','#FFFFFF']){
    const c=control(ui,label);const style={...defaultTextStyle(colorA),mode,colorB:'#C0A0FF',overrides:{0:'#F09015'}};c.props.onChange(style);
    const text=c.props.text|| (label==='操作栏'?'ACTIONBAR':'');const parts=coloredParts(text,style),expected=previewTextParts(parts,version);
    if(old){const data=JSON.parse(textComponent(parts,version));assert.deepEqual(expected.map(p=>p.color),(Array.isArray(data)?data:[data]).map(p=>palette[p.color]));}
    if(mode==='solid'&&colorA==='#F09015')assert.equal(expected[0].color,old?'#FFAA00':'#F09015');
    assert.ok(expected.every(p=>spanColors(ui,tool==='ColorTool'?'mc-chat-preview':'mc-title-preview').includes(p.color)),`${version}/${tool}/${label}/${mode}`);counts.previewColors++;
   }
  }
  ui.unmount();
 }
}
console.log('Sixth pass passed:',JSON.stringify(counts),'total',Object.values(counts).reduce((a,b)=>a+b,0));
