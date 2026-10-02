import { readFileSync, writeFileSync } from 'node:fs';
import { loadTs } from './mc-test-runtime.mjs';
import { mount } from './mc-interaction-runtime.mjs';
import { modernTargetNativeFixtures } from './mc-target-fixtures.mjs';
import { MC_ITEM_NATIVE_FIXTURES } from './mc-item-fixtures.mjs';
const {makeGiveCommand}=loadTs('../src/lib/mc/give.ts');
const {makePotionCommand}=loadTs('../src/lib/mc/potion.ts');
const {makeBannerCommand,BANNER_COLORS,BANNER_PATTERNS}=loadTs('../src/lib/mc/banner.ts');
const {createDataPackFiles}=loadTs('../src/lib/mc/datapack.ts');
const {importGiveForRecipe}=loadTs('../src/lib/mc/give-recipe.ts');
const {coloredParts,defaultTextStyle,textComponent}=loadTs('../src/lib/mc/textColors.ts');
const catalog=JSON.parse(readFileSync('public/mc-data/26.1.json','utf8'));
const version='26.1', cases=[];
const add=(kind,id,value)=>cases.push({kind,id,value});
const give={version,target:'@p',count:1,name:'',lore:[],unbreakable:false,enchantments:[]};
for(const item of catalog.items) add('command',`item:${item.name}`,makeGiveCommand({...give,item:item.name}));
for(const e of catalog.enchantments) for(const level of [1,e.maxLevel,255]) for(const item of ['diamond_sword','enchanted_book']) add('command',`enchant:${e.name}:${level}:${item}`,makeGiveCommand({...give,item,enchantments:[{name:e.name,level}],name:'彩色中文 🐈‍⬛',lore:['引号\'"\\','换行\n\t\0'],unbreakable:true}));
for(const effect of catalog.effects) for(const level of [1,128,256]) for(const duration of [1,60,1000000]) for(const hideParticles of [true,false]) add('command',`potion:${effect.name}:${level}:${duration}:${hideParticles}`,makePotionCommand({version,target:'@p',catalog,effects:[{name:effect.name,level,duration}],hideParticles}));
add('command','potion:all-effects',makePotionCommand({version,target:'@p',catalog,effects:catalog.effects.map(e=>({name:e.name,level:2,duration:180})),hideParticles:false}));
for(const target of ['banner','shield']) for(const color of BANNER_COLORS) for(const [pattern] of BANNER_PATTERNS) add('command',`banner:${target}:${color.id}:${pattern}`,makeBannerCommand({version,target,base:color.id,layers:[{pattern,color:color.id}]}));
for(const target of ['banner','shield']) for(const n of [0,6,16]) add('command',`banner:layers:${target}:${n}`,makeBannerCommand({version,target,base:'red',layers:BANNER_PATTERNS.slice(0,n).map(([pattern],i)=>({pattern,color:BANNER_COLORS[i%16].id}))}));
for(const mode of ['solid','gradient','alternate','manual']) for(const message of ['', '你好 Minecraft',' a\n b\t c ','\0\b\f\r\u001b', '🐈‍⬛ é 🇨🇳','引号\'"\\','§kHello']) {const component=textComponent(coloredParts(message,{...defaultTextStyle(),mode,overrides:{1:'#AA00FF'}}),version);add('text',`text:${mode}:${JSON.stringify(message)}`,component);add('command',`title:${mode}:${JSON.stringify(message)}`,`/title @p title ${component}`);add('command',`tellraw:${mode}:${JSON.stringify(message)}`,`/tellraw @a ${component}`);}
const base={version,title:'Native audit',description:'中文 🐈‍⬛',namespace:'pkqa',recipeEnabled:true,recipeName:'check',recipeType:'shaped',grid:['diamond','','','','','','','',''],result:'diamond',resultCount:1,lootEnabled:true,lootName:'check',rolls:1,loot:[{item:'diamond',weight:1,count:1}],validItems:new Set(catalog.items.map(i=>i.name))};
function pack(id,extra){const output=createDataPackFiles({...base,...extra});if(output.errors.length)throw new Error(id+output.errors);for(const f of output.files){const v=JSON.parse(f.content);add(f.name==='pack.mcmeta'?'pack':f.name.includes('/recipe/')?'recipe':'loot',`${id}:${f.name}`,f.name==='pack.mcmeta'?v.pack:v);}}
for(let mask=1;mask<512;mask++)for(const recipeType of ['shaped','shapeless'])pack(`mask:${mask}:${recipeType}`,{recipeType,grid:Array.from({length:9},(_,i)=>mask&(1<<i)?'diamond':'')});
for(const result of ['diamond','diamond_sword','ender_pearl'])for(const resultCount of [1,2,16,64])pack(`result:${result}:${resultCount}`,{result,resultCount});
for(const weight of [1,1000])for(const count of [1,64])for(const rolls of [1,64])pack(`loot:${weight}:${count}:${rolls}`,{rolls,loot:[{item:'diamond_sword',weight,count}]});
for(const enchantment of catalog.enchantments){const cmd=makeGiveCommand({...give,item:'diamond_sword',name:'附魔武器',lore:['第一行','第二行'],unbreakable:true,enchantments:[{name:enchantment.name,level:5}]});const imported=importGiveForRecipe(cmd,version,catalog);pack(`attributed:${enchantment.name}`,{result:imported.item,resultCount:imported.count,resultComponents:imported.components});}
for(const b of catalog.blocks)add('command',`block:${b.name}`,`/setblock 0 64 0 minecraft:${b.name}`);
for(const e of catalog.entities)add('command',`entity:${e.name}`,`/summon minecraft:${e.name} ~ ~ ~`);
for(const e of catalog.effects)add('command',`effect:${e.name}`,`/effect give @p minecraft:${e.name} 1000000 255 true`);
for(const e of catalog.entities)add('entity',e.name,'minecraft:'+e.name);
for(const name of ['player','fishing_bobber'])cases.push({kind:'entity',id:`seventh-forbidden-entity:${name}`,value:`minecraft:${name}`,reject:true});
add('item','seventh-default-stone-stack',{id:'minecraft:stone',count:1});
cases.push({kind:'item',id:'seventh-unknown-stack',value:{id:'minecraft:missing_audit_item',count:1},reject:true});
cases.push(...modernTargetNativeFixtures());
cases.push(...MC_ITEM_NATIVE_FIXTURES);
// Negative controls ensure a broken or permissive oracle cannot pass silently.
for(const n of [2147483648,9007199254740991,-2147483649])cases.push({kind:'command',id:`block-overflow:${n}`,value:`/setblock ${n} 64 0 minecraft:stone`,reject:true});
for(const [x,y,z,reject] of [[30000000,64,0,true],[-30000001,64,0,true],[0,20000000,0,true],[0,-20000001,0,true],[-30000000,-20000000,29999999,false],[29999999,19999999,-30000000,false]])cases.push({kind:'position',id:`position:${x}:${y}:${z}`,value:[x,y,z],reject});
for(const tool of ['EffectTool','TitleTool','BlockTool','SummonTool','CoordinateTool','WorldTool','ColorTool']) {
  const ui=mount(tool,{version,catalog}); for(const [i,command] of ui.commands().entries())add('command',`ui:${tool}:${i}`,command);ui.unmount();
}
writeFileSync('coverage/native26-cases.json',JSON.stringify(cases));console.log('Native fixtures:',cases.length);
