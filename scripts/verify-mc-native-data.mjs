import fs from 'node:fs';
import assert from 'node:assert/strict';
const c=JSON.parse(fs.readFileSync('public/mc-data/26.1.json')),recipes=JSON.parse(fs.readFileSync('coverage/official26-recipes.json')),tags=JSON.parse(fs.readFileSync('coverage/official26-tags.json'));
const name=x=>x?.replace(/^minecraft:/,'');
const expand=value=>Array.isArray(value)?value.flatMap(expand):value.startsWith('#')?(tags[name(value.slice(1))]?.values??[]).flatMap(v=>expand(typeof v==='string'?v:v.id)):[name(value)];
const game=Object.values(recipes).filter(r=>['minecraft:crafting_shaped','minecraft:crafting_shapeless'].includes(r.type));
const trim=shape=>{const used=shape.flatMap((r,y)=>r.some(Boolean)?[y]:[]);if(!used.length)return[];const rows=shape.slice(used[0],used.at(-1)+1);const xs=rows.flatMap(r=>r.flatMap((v,i)=>v?[i]:[]));return rows.map(r=>r.slice(Math.min(...xs),Math.max(...xs)+1));};
function matchShape(recipe,actual){const shape=trim(actual),expected=trim(recipe.pattern.map(row=>[...row].map(symbol=>symbol===' '?null:expand(recipe.key[symbol]))));if(shape.length!==expected.length||shape.some((r,i)=>r.length!==expected[i].length))return false;return [false,true].some(mirror=>shape.every((row,y)=>row.every((id,x)=>{const allowed=expected[y][mirror?row.length-1-x:x];return !allowed?!id:!!id&&allowed.includes(id);})));}
function matchIngredients(recipe,actual){const allowed=recipe.ingredients.map(expand);if(allowed.length!==actual.length)return false;function walk(i,used){if(i===actual.length)return true;return allowed.some((set,k)=>!(used&(1<<k))&&set.includes(actual[i])&&walk(i+1,used|(1<<k)));}return walk(0,0);}
const failures=[];let count=0;for(const [item,variants] of Object.entries(c.recipes))for(const [i,r] of variants.entries()){count++;const matches=game.filter(g=>name(g.result.id)===item&&(g.result.count??1)===r.count&&(r.shape?g.type==='minecraft:crafting_shaped'&&matchShape(g,r.shape):g.type==='minecraft:crafting_shapeless'&&matchIngredients(g,r.ingredients)));if(!matches.length)failures.push({item,i,recipe:r});}
fs.writeFileSync('coverage/native-crafting-comparison.json',JSON.stringify(failures,null,2));
assert.ok(count>1600,'Crafting comparison must not pass with an empty/partial catalog');
assert.deepEqual(failures,[],'Every displayed crafting recipe must match official game resources');
assert.deepEqual(new Set(Object.keys(c.recipes)),new Set(game.map(r=>name(r.result.id))),'All official shaped/shapeless craftable outputs should be represented');
assert.equal(matchShape(recipes.acacia_shelf,[['stripped_acacia_log','stripped_acacia_log','stripped_acacia_log'],['stripped_acacia_log','stripped_acacia_log','stripped_acacia_log']]),false,'Internal empty rows are meaningful');
for(const r of c.processingRecipes){
 const v=recipes[r.id];assert.ok(v,`Missing official processing recipe: ${r.id}`);
 for(const k of ['ingredient','template','base','addition'])assert.deepEqual(r[k]??null,v[k]??null,`${r.id}/${k}`);
 for(const [key,value] of [['type',v.type.replace('minecraft:','')],['result',v.result?.id??v.result??null],['count',v.result?.count??v.count??1],['ticks',v.cookingtime??null],['xp',v.experience??null]])assert.equal(r[key],value,`${r.id}/${key}`);
}
assert.ok(c.processingRecipes.length>400);
console.log(`Official recipe data passed: ${count} crafting variants, ${Object.keys(c.recipes).length} craftable outputs, ${c.processingRecipes.length} processing recipes.`);
