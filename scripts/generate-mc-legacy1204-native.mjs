import { readFileSync, writeFileSync } from 'node:fs';
import { loadTs } from './mc-test-runtime.mjs';
import { mount } from './mc-interaction-runtime.mjs';
import { MODERN_TARGET_FIXTURES } from './mc-target-fixtures.mjs';
const version='1.20.4';
const catalog=JSON.parse(readFileSync(`public/mc-data/${version}.json`,'utf8'));
const {makeGiveCommand}=loadTs('../src/lib/mc/give.ts');
const {makePotionCommand}=loadTs('../src/lib/mc/potion.ts');
const {makeBannerCommand,BANNER_COLORS,availableBannerPatterns}=loadTs('../src/lib/mc/banner.ts');
const {createDataPackFiles}=loadTs('../src/lib/mc/datapack.ts');
const {importGiveForRecipe}=loadTs('../src/lib/mc/give-recipe.ts');
const {coloredParts,defaultTextStyle,textComponent}=loadTs('../src/lib/mc/textColors.ts');
const {isCommandTarget}=loadTs('../src/lib/mc/target.ts');
const cases=[],localResults=[];
const add=(kind,id,value,extra={})=>cases.push({kind,id,value,...extra});
const baseGive={version,target:'@p',count:1,name:'',lore:[],unbreakable:false,enchantments:[]};
for(const item of catalog.items)add('command',`catalog-item:${item.name}`,makeGiveCommand({...baseGive,item:item.name}));
for(const name of ['中文 🐈‍⬛ é 🇨🇳',`引号'"\\`, '\n\t\0\r\b\f','§k秘密','#000000', '  名称  ', 'a'.repeat(256)]) {
  for(const item of ['diamond_sword','enchanted_book'])for(const level of [1,5,255])add('give-name',`name:${item}:${level}:${JSON.stringify(name)}`,makeGiveCommand({...baseGive,item,name,lore:['第一行',name],unbreakable:true,enchantments:[{name:'sharpness',level}]}),{name});
}
for(const effect of catalog.effects)for(const level of [1,127,128,129,255,256])for(const duration of [1,60,1000000])for(const hideParticles of [true,false])add('potion',`potion:${effect.name}:${level}:${duration}:${hideParticles}`,makePotionCommand({version,target:'@p',catalog,effects:[{name:effect.name,level,duration}],hideParticles}),{effects:[{name:effect.name,duration:duration*20,amplifier:Math.min(127,level-1),visible:!hideParticles}]});
add('potion','all-effects',makePotionCommand({version,target:'@p',catalog,effects:catalog.effects.map(effect=>({name:effect.name,level:2,duration:180})),hideParticles:false}),{effects:catalog.effects.map(effect=>({name:effect.name,duration:3600,amplifier:1,visible:true}))});
for(const target of ['banner','shield'])for(const color of BANNER_COLORS)for(const [pattern] of availableBannerPatterns(version))add('banner',`banner:${target}:${color.id}:${pattern}`,makeBannerCommand({version,target,base:color.id,layers:[{pattern,color:color.id}]}),{base:BANNER_COLORS.findIndex(entry=>entry.id===color.id),patterns:1,shield:target==='shield'});
for(const target of ['banner','shield'])for(const count of [0,6,16])add('banner',`banner-layers:${target}:${count}`,makeBannerCommand({version,target,base:'red',layers:availableBannerPatterns(version).slice(0,count).map(([pattern],i)=>({pattern,color:BANNER_COLORS[i%16].id}))}),{base:14,patterns:count,shield:target==='shield'});
for(const mode of ['solid','gradient','alternate','manual'])for(const message of ['你好 Minecraft', ' a\n b\t c ', '\0\b\f\r\u001b','🐈‍⬛ é 🇨🇳',`引号'"\\`]) {
  const component=textComponent(coloredParts(message,{...defaultTextStyle(),mode,overrides:{1:'#AA00FF'}}),version);add('text',`component:${mode}:${JSON.stringify(message)}`,component);add('command',`title:${mode}:${JSON.stringify(message)}`,`/title @p title ${component}`);add('command',`tellraw:${mode}:${JSON.stringify(message)}`,`/tellraw @a ${component}`);
}
const packBase={version,title:'Legacy official audit',description:'中文 🐈‍⬛',namespace:'pkqa',recipeEnabled:true,recipeName:'check',recipeType:'shaped',grid:['diamond','','','','','','','',''],result:'diamond',resultCount:1,lootEnabled:true,lootName:'check',rolls:1,loot:[{item:'diamond',weight:1,count:1}],validItems:new Set(catalog.items.map(item=>item.name))};
function pack(id,extra){const result=createDataPackFiles({...packBase,...extra});if(result.errors.length)throw Error(id+result.errors.join());for(const file of result.files)if(file.name!=='pack.mcmeta')add(file.name.includes('/recipes/')?'recipe':'loot',`${id}:${file.name}`,JSON.parse(file.content));}
for(const mask of [1,2,4,8,16,32,64,128,256,7,56,448,73,146,292,257,383,511])for(const recipeType of ['shaped','shapeless'])pack(`recipe:${mask}:${recipeType}`,{recipeType,grid:Array.from({length:9},(_,i)=>mask&(1<<i)?'diamond':'')});
for(const result of ['diamond','diamond_sword','ender_pearl'])for(const resultCount of [1,2,16,64])pack(`result:${result}:${resultCount}`,{result,resultCount});
for(const weight of [1,1000])for(const count of [1,64])for(const rolls of [1,64])pack(`loot:${weight}:${count}:${rolls}`,{rolls,loot:[{item:'diamond_sword',weight,count}]});
for(const entity of catalog.entities)add('command',`entity:${entity.name}`,`/summon minecraft:${entity.name} ~ ~ ~`);
add('item-entity','stone-drop-default','/summon minecraft:item ~ ~ ~ {Item:{id:"minecraft:stone",Count:1b}}');
for(const [target] of MODERN_TARGET_FIXTURES)for(const playerOnly of [true,false]) {
  const expected=isCommandTarget(target,version,{playersOnly:playerOnly});
  add('command',`selector:${playerOnly?'give':'effect'}:${target}`,playerOnly?`/give ${target} minecraft:stone 1`:`/effect give ${target} minecraft:speed 60 1 true`,{reject:!expected});
}
for(const tool of ['EffectTool','TitleTool','SummonTool','ColorTool']) {const ui=mount(tool,{version,catalog});for(const [i,command] of ui.commands().entries())add('command',`ui:${tool}:${i}`,command);ui.unmount();}
for(const input of [makeGiveCommand({...baseGive,item:'diamond_sword',name:'旧版',enchantments:[{name:'sharpness',level:5}]}),'/give @p minecraft:diamond 1']) {
  let rejected=false;try{importGiveForRecipe(input,version,catalog);}catch(error){rejected=/不能直接生成带属性/.test(error.message);}if(!rejected)throw Error('1.20.4 attributed recipe importer should be unavailable');localResults.push({kind:'recipe-import',rejected:true,input});
}
add('command','control:unknown-item','/give @p minecraft:invalid_legacy_probe_item 1',{reject:true});
add('command','control:component-era-item','/give @p minecraft:diamond[custom_name={text:"wrong era"}] 1',{reject:true});
add('command','control:unknown-entity','/summon minecraft:invalid_legacy_probe_entity ~ ~ ~',{reject:true});
add('command','control:unterminated-nbt','/give @p minecraft:stone{display:{Name:"broken"} 1',{reject:true});
add('recipe','control:bad-item',{type:'minecraft:crafting_shapeless',ingredients:[{item:'minecraft:invalid_legacy_probe_item'}],result:{item:'minecraft:diamond'}},{reject:true});
for(const amplifier of [126,127,128,254,255])add('potion',`control:raw-amplifier:${amplifier}`,`/give @p minecraft:potion{custom_potion_effects:[{id:"minecraft:speed",amplifier:${amplifier},duration:1200,show_particles:false}]} 1`,{effects:[{name:'speed',duration:1200,amplifier:amplifier<=127?amplifier:0,visible:false}]});
add('potion','control:semantic-amplifier-255-does-not-survive','/give @p minecraft:potion{custom_potion_effects:[{id:"minecraft:speed",amplifier:255,duration:1200,show_particles:false}]} 1',{effects:[{name:'speed',duration:1200,amplifier:255,visible:false}],reject:true});
for(const nbt of ['{"":1}',"{'':1}"])add('nbt',`control:empty-key:${nbt}`,nbt,{reject:true});
add('command','control:selector-empty-nbt-key','/give @p[nbt={"":1}] minecraft:diamond 1',{reject:true});
writeFileSync('coverage/legacy1204/cases.json',JSON.stringify(cases));writeFileSync('coverage/legacy1204/local-results.json',JSON.stringify(localResults,null,2));console.log('Prepared official legacy fixtures:',cases.length);
