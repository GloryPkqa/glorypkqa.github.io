import { readFileSync } from 'node:fs';

// Fixed public-oracle cases: this module never depends on generated coverage.
// Semantic constraints were checked against the checksum-pinned official 26.1
// server before being recorded. Unsupported name escapes remain Vanilla-valid
// positive controls while the UI explains its deliberate browser limitation.
export const NBT_ORACLE_CASES = JSON.parse(readFileSync(new URL('./fixtures/mc-seventh-nbt.json', import.meta.url), 'utf8')).cases;
export const VALID_GIVE_TARGETS = ['@p[ distance=..10 ]', '@p[sort=nearest, scores={ test=1.. } ]', '@p[name="hello world"]', "@p[name='hello world']", '@p[nbt={Inventory:[{id:"minecraft:diamond"}]}]', '@p[nbt={Text:\'a ] } b\'}]', 'Pkqa'];
export const INVALID_GIVE_TARGETS = ['@p[distance=1..0]', '@p[limit=0]', '@p[dx=+1]', '@p[tag="hello world"]', '@p[scores={foo:bar=1}]', '@p[nbt={Items:[}]]', '@p[name="unclosed]', '@p[nbt={text:"bad\\q"}]', '@p[]bad', '@e', '@p[unknown=1]', 'd5ebe79d-588c-4cba-b338-f5f27109ec83'];
const lore = n => Array.from({ length: n }, () => ({ text: 'x' }));
const loreCommand = n => `/give @p minecraft:diamond_sword[lore=[${lore(n).map(() => "{text:'x'}").join(',')}]] 1`;
const loreRecipe = n => ({ type: 'minecraft:crafting_shapeless', ingredients: ['minecraft:diamond'], result: { id: 'minecraft:diamond_sword', count: 1, components: { 'minecraft:lore': lore(n) } } });
export const MC_ITEM_NATIVE_FIXTURES = [
  ...NBT_ORACLE_CASES.map(row => ({ kind: 'command', id: `seventh-snbt:${row.snbt}`, value: `/give @p[nbt=${row.snbt}] minecraft:diamond 1`, ...(!row.accepted ? { reject: true } : {}) })),
  ...VALID_GIVE_TARGETS.map(target => ({ kind: 'command', id: `seventh-selector:${target}`, value: `/give ${target} minecraft:diamond_sword[custom_name={text:'边界验证'},unbreakable={}] 2` })),
  ...INVALID_GIVE_TARGETS.map(target => ({ kind: 'command', id: `seventh-selector-invalid:${target}`, value: `/give ${target} minecraft:diamond_sword 1`, reject: true })),
  ...[255, 256, 257].flatMap(n => [{ kind: 'command', id: `seventh-lore-command:${n}`, value: loreCommand(n), ...(n > 256 ? { reject: true } : {}) }, { kind: 'recipe', id: `seventh-lore-recipe:${n}`, value: loreRecipe(n), ...(n > 256 ? { reject: true } : {}) }]),
  ...['/give @p diamond_sword[unbreakable={}]2', '/give @p diamond_sword [unbreakable={}] 2', '/give @p minecraft:DIAMOND 1'].map((value, i) => ({ kind: 'command', id: `seventh-item-spacing-negative:${i}`, value, reject: true })),
  ...['/give @p diamond_sword[ unbreakable = {} ] 2', '/give @p diamond_sword[unbreakable={},] 2', '/give @p diamond_sword[custom_name={text:"x",},unbreakable={}] 2'].map((value, i) => ({ kind: 'command', id: `seventh-item-spacing-positive:${i}`, value })),
  ...['a:b', '@a', '🦊', 'foo!', 'hi:type', '+0', '-0xF', '1f', 'bool(1)', '0xFF', '1ub'].map(raw => ({ kind: 'command', id: `seventh-literal-text-invalid:${raw}`, value: `/give @p diamond[custom_name={text:${raw}}]`, reject: true })),
  ...['\u00a0', '\u2007', '\u202f', '\ufeff'].flatMap((space, i) => [
    ...[`/give @p[nbt={a:${space}1}] minecraft:diamond 1`, `/give${space}@p diamond 1`, `/give @p${space}diamond 1`, `/give @p diamond[${space}unbreakable={}] 1`, `/give @p diamond[custom_name={text:${space}'x'}] 1`, `/give @p diamond[unbreakable={}]${space}1`, `/give @p diamond 1${space}`].map((value, j) => ({ kind: 'command', id: `seventh-JS-whitespace-negative:${i}:${j}`, value, reject: true })),
    { kind: 'command', id: `seventh-quoted-whitespace-positive:${i}`, value: `/give @p diamond[custom_name={text:'a${space}b'}] 1` },
  ]),
];
