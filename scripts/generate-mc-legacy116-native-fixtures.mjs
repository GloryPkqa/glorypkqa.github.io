import { writeFileSync, readFileSync } from 'node:fs';
import { loadTs } from './mc-test-runtime.mjs';
import { mount } from './mc-interaction-runtime.mjs';
import { NBT_ORACLE_CASES, VALID_GIVE_TARGETS, INVALID_GIVE_TARGETS } from './mc-item-fixtures.mjs';
const {makeGiveCommand}=loadTs('../src/lib/mc/give.ts');
const {compoundNbt}=loadTs('../src/lib/mc/targetNbt.ts');
const {isCommandTarget}=loadTs('../src/lib/mc/target.ts');
const rows=[];
// Frozen values read from official MobEffectInstance.load, not computed with
// the site's clamp. getByte narrows ints and rejects overflow-byte strings.
for(const [raw,actualAmplifier] of [['-129b',0],['-129',127],['-128b',0],['-128',0],['-1b',0],['-1',0],['0b',0],['0',0],['126b',126],['126',126],['127b',127],['127',127],['128b',0],['128',0],['254b',0],['254',0],['255b',0],['255',0]]) {
 rows.push({id:`semantic-amplifier/${raw}`,kind:'effect',value:`{Id:5b,Amplifier:${raw},Duration:1200,ShowParticles:0b}`,expected:true,expectedAmplifier:actualAmplifier,expectedDuration:1200,expectedVisible:false});
 rows.push({id:`semantic-potion/${raw}`,kind:'potion',value:`{CustomPotionEffects:[{Id:5b,Amplifier:${raw},Duration:1200,ShowParticles:0b}]}`,expected:true,expectedAmplifier:actualAmplifier,expectedDuration:1200,expectedVisible:false});
}
const command=(id,value,expected=true)=>rows.push({id,kind:'command',value,expected});
const snbt=(id,value)=>rows.push({id,kind:'snbt',value,expected:compoundNbt(value,'1.16.5')});
const give=(options={})=>makeGiveCommand({version:'1.16.5',item:'diamond_sword',count:2,target:'@p',name:'测试 🦊 \' 单引号 " 双引号 \\ 斜杠',lore:['首行','尾行 🐈‍⬛'],unbreakable:true,enchantments:[{name:'sharpness',level:5}],...options});
for(const item of ['diamond_sword','enchanted_book','stone','player_head','potion','netherite_sword','crossbow']) command('give/'+item,give({item}));
for(const target of ['@p','Pkqa','@a[limit=1,sort=random]','@a[name="first last"]','@p[nbt={Inventory:[{id:"minecraft:diamond"}]}]','@p[nbt={a:[I;1,2,3],b:[B;1b,-128b,127b],c:[L;1l]}]','@p[nbt={a:[1,2]}]','@p[nbt={a:[1,"str"]}]','@p[nbt={a:128b}]','@p[nbt={a:"\\n"}]','@p[nbt={a:"🦊"}]','@p[nbt={a:"\\u0041"}]']) command('selector/'+target,give({target}),isCommandTarget(target,'1.16.5',{playersOnly:true}));
const catalog=JSON.parse(readFileSync('public/mc-data/1.16.5.json','utf8'));
for(const effect of catalog.effects) command('effect/'+effect.name,`/effect give @p minecraft:${effect.name} 60 0 true`);
command('effect/infinite','/effect give @p minecraft:strength infinite 0 true',false);
command('effect/oldSyntax','/effect @p minecraft:strength 60 0 true',false);
command('effect/clear','/effect clear @p');
for(const text of [{text:'中文 🦊',color:'#f0a1bc'},{text:'mixed',extra:[{text:'A',color:'red'},{text:'B',color:'#aabbcc'}]},[{text:'prefix'},{text:'suffix',bold:true}]]) command('title/'+JSON.stringify(text),'/title @p title '+JSON.stringify(text));
command('title/reset','/title @p reset'); command('title/times','/title @p times 10 70 20');
for(const entity of ['pig','armor_stand','zombie','falling_block','item','area_effect_cloud','wither','ender_dragon']) command('summon/'+entity,`/summon minecraft:${entity} ~ ~ ~ {CustomName:'{"text":"中文"}',NoAI:1b,Tags:["audit"]}`);
command('summon/newEntity','/summon minecraft:allay ~ ~ ~',false);
command('summon/negativeDimension','/summon minecraft:pig ~ ~ ~ {a:[1,"s"]}',false);
for(const [id,value] of Object.entries({
 empty:'{}',normal:'{a:1,b:1b,c:-128b,d:127b,e:32767s,f:2147483647,g:9223372036854775807l}',
 overflow:'{a:128b,b:-129b,c:32768s,d:2147483648,e:9223372036854775808l}',
 floats:'{a:1e2,b:1.2f,c:1e999,d:1e999f,e:1d,f:1f}',hex:'{a:0xF,b:1_0,c:0b10}',
 plus:'{a:+0,b:-0,c:01,d:+01}',colon:'{a:a:b}',emoji:'{a:🦊}',dot:'{a:foo.bar-baz+yes}',
 bool:'{a:true,b:false}',trailing:'{a:1,}',mixList:'{a:[1,"a"]}',mixCompound:'{a:[{},{}]}',
 arrays:'{a:[B;1b,-128b,127b],b:[I;1,-1],c:[L;1l]}',arrayWrong:'{a:[B;1]}',arrayOverflow:'{a:[B;128b]}',
 byteBool:'{a:[B;true,false]}',listTrailing:'{a:[1,2,]}',quoteEsc:'{a:"a\\\"b\\\\c"}',
 singleQuote:'{a:\'a\\\'b\'}',newlineEsc:'{a:"\\n"}',unicodeEsc:'{a:"\\u0041"}',
 modernUuid:'{a:uuid("00000000-0000-0000-0000-000000000000")}',modernBool:'{a:bool(1)}',
 colonKey:'{minecraft:id:1}',quotedColonKey:'{"minecraft:id":1}',duplicate:'{a:1,a:2}',
 trailingGarbage:'{}tail',unclosed:'{a:[1}', quoteRawLF:'{a:"first\nlast"}',
})) snbt('snbt/'+id,value);
for(const code of [9,10,11,12,13,28,29,30,31,32,0xa0,0x1680,0x2000,0x2006,0x2007,0x2008,0x2028,0x2029,0x202f,0x205f,0x3000,0xfeff]) snbt('whitespace/'+code,`{a:${String.fromCharCode(code)}1}`);
for(const row of NBT_ORACLE_CASES) snbt('old-seventh/'+row.snbt,row.snbt);
for(const item of catalog.items) command('catalog/item/'+item.name,give({item:item.name,name:'',lore:[],enchantments:[]}));
for(const enchantment of catalog.enchantments) for(const level of [1,enchantment.maxLevel,255]) command(`enchantment/${enchantment.name}/${level}`,give({item:'enchanted_book',enchantments:[{name:enchantment.name,level}]}));
for(const target of [...VALID_GIVE_TARGETS,...INVALID_GIVE_TARGETS]) command('shared-selector/'+target,`/give ${target} minecraft:diamond 1`,isCommandTarget(target,'1.16.5',{playersOnly:true}));
for(const base of ['@p','@a','@r','@e','@s']) for(const option of ['type=player','type=!pig','type=zombie','type=#minecraft:skeletons','type=allay','type=minecraft:player','gamemode=creative','gamemode=!creative','name=A,name=B','name=!A,name=B','name=A,name=!B','name=!A,name=!B','team=A,team=B','team=!A,team=B','team=A,team=!B','team=!A,team=!B','tag=','tag=!','name=""','team=','nbt={a:1}','nbt=!{a:1}','predicate=minecraft:test','predicate=!minecraft:test','distance=..5','distance=-1','distance=1..0','x_rotation=100..-100','limit=1','sort=nearest','advancements={}','advancements={minecraft:test=true}','scores={foo=1..2}','scores={}']) {
 const target=`${base}[${option}]`;command('selector-grid/'+target,`/give ${target} minecraft:diamond 1`,isCommandTarget(target,'1.16.5',{playersOnly:true}));
}
for(const entity of catalog.entities) {
 const ui=mount('SummonTool',{version:'1.16.5',catalog});ui.edit(ui.all('input')[0],entity.name);
 for(const [i,value] of ui.commands().entries()) command(`ui/summon/${entity.name}/${i}`,value);
 ui.unmount();
}
const effectUI=mount('EffectTool',{catalog});
for(const effect of catalog.effects){effectUI.edit(effectUI.all('select')[0],effect.name);for(const [i,value] of effectUI.commands().entries()) command(`ui/effect/${effect.name}/${i}`,value);}
effectUI.edit(effectUI.all('input').find(n=>n.props.type==='checkbox'),true);
for(const [i,value] of effectUI.commands().entries()) command(`ui/potion/default/${i}`,value);
effectUI.button('添加一种效果').props.onClick();
for(const input of effectUI.all('input').filter(n=>n.props.type==='number')) effectUI.edit(input,String(input.props.max));
for(const [i,value] of effectUI.commands().entries()) command(`ui/potion/max/${i}`,value);
effectUI.unmount();
const titleUI=mount('TitleTool',{version:'1.16.5'});
for(const [i,value] of titleUI.commands().entries()) command(`ui/title/default/${i}`,value);
for(const input of titleUI.all('input').filter(n=>n.props.type==='number')) titleUI.edit(input,'60');
titleUI.edit(titleUI.all('input')[0],'A🦊B"C\\D\n中文');
for(const [i,value] of titleUI.commands().entries()) command(`ui/title/max/${i}`,value);
titleUI.unmount();
for(const key of ['""',"''"]) {
 snbt('empty-key/'+key,`{${key}:1}`);
 const target=`@p[nbt={${key}:1}]`;
 for(const value of [`/give ${target} minecraft:diamond 1`,`/effect give ${target} minecraft:strength 60 0`,`/title ${target} title {"text":"x"}`]) command('empty-key-target/'+value,value,isCommandTarget(target,'1.16.5',{playersOnly:true}));
}
writeFileSync('coverage/legacy116/cases.json',JSON.stringify(rows,null,2)); console.log(rows.length+' official old-version differential controls');
