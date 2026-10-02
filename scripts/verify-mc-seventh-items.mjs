import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadTs } from './mc-test-runtime.mjs';
import { mount } from './mc-interaction-runtime.mjs';
import { NBT_ORACLE_CASES, VALID_GIVE_TARGETS, INVALID_GIVE_TARGETS, MC_ITEM_NATIVE_FIXTURES } from './mc-item-fixtures.mjs';

const { MC_VERSIONS, versionAtLeast, makeGiveCommand, MAX_COMPONENT_LORE_LINES } = loadTs('../src/lib/mc/give.ts');
const { importGiveForRecipe } = loadTs('../src/lib/mc/give-recipe.ts');
const { createDataPackFiles } = loadTs('../src/lib/mc/datapack.ts');
const { zipFiles } = loadTs('../src/lib/mc/zip.ts');
const { compoundNbt } = loadTs('../src/lib/mc/targetNbt.ts');
const { targetErrorHint } = loadTs('../src/lib/mc/target.ts');
const versions = MC_VERSIONS.filter(v => versionAtLeast(v, '1.16'));
const catalogs = Object.fromEntries(MC_VERSIONS.map(v => [v, JSON.parse(readFileSync(`public/mc-data/${v}.json`, 'utf8'))]));
const counts = { giveEditing: 0, packEditing: 0, selectorImport: 0, loreBoundaries: 0, importRecovery: 0, archiveBoundaries: 0, nbtSyntax: 0 };
const numberInputs = ui => ui.all('input').filter(n => n.props.type === 'number');
const give = version => ({ version, item: 'diamond_sword', count: 2, target: '@p', name: '已确认的武器', lore: ['描述'], unbreakable: true, enchantments: [{ name: 'sharpness', level: 5 }] });
const packInput = version => ({ version, title: '边界检查', description: '中文与 emoji 🐈‍⬛', namespace: 'pkqa', recipeEnabled: true, recipeName: 'test', recipeType: 'shaped', grid: ['diamond', '', '', '', '', '', '', '', ''], result: 'diamond_sword', resultCount: 1, lootEnabled: true, lootName: 'test', rolls: 1, loot: [{ item: 'diamond', weight: 1, count: 1 }], validItems: new Set(catalogs[version].items.map(i => i.name)) });

// Reproduce a real edit, including the temporary empty state and incomplete
// decimals. The UI must not silently copy a different quantity or level.
for (const version of versions) {
  const ui = mount('McWorkbench', { version, catalog: catalogs[version] }, { exportName: 'GiveTool' });
  ui.edit(ui.all('select')[0], 'sharpness'); ui.button('添加').props.onClick();
  for (const [index, max] of [[0, 64], [1, 255]]) {
    for (const invalid of ['', '0', '-1', String(max + 1), '1.5', 'Infinity', 'NaN']) {
      ui.edit(numberInputs(ui)[index], invalid);
      assert.equal(ui.commands().length, 0, `${version}/${index}/${invalid}`);
      assert.equal(ui.nodes().find(n => n.type?.name === 'CopyButton').props.value, '');
      assert.match(ui.text(), /请填写完整的整数数量/);
      if (!invalid) assert.equal(numberInputs(ui)[index].props.value, '');
      ui.edit(numberInputs(ui)[index], '12');
      assert.ok(ui.commands()[0]); assert.equal(numberInputs(ui)[index].props.value, 12);
      counts.giveEditing++;
    }
    ui.edit(numberInputs(ui)[index], String(max));
    assert.ok(ui.commands()[0]); counts.giveEditing++;
    ui.edit(numberInputs(ui)[index], '1');
  }
  ui.unmount();

  const pack = mount('DataPackTool', { version, catalog: catalogs[version] });
  const initial = numberInputs(pack).map(n => n.props.value);
  for (const [index, original] of initial.entries()) {
    for (const invalid of ['', '0', '-1', String(Number(numberInputs(pack)[index].props.max) + 1), '1.5']) {
      pack.edit(numberInputs(pack)[index], invalid);
      if (!invalid) assert.equal(numberInputs(pack)[index].props.value, '');
      assert.equal(pack.button('下载数据包').props.disabled, true);
      assert.ok(pack.nodes().some(n => n.props.className === 'mc-pack-errors'));
      pack.edit(numberInputs(pack)[index], String(original));
      assert.equal(pack.button('下载数据包').props.disabled, false);
      counts.packEditing++;
    }
  }
  for (const key of ['lucky_diamond', 'starter_gift']) {
    const input = pack.all('input').find(n => n.props.value === key);
    assert.equal(input.props.maxLength, 128);
    pack.edit(input, 'a'.repeat(129)); assert.equal(pack.button('下载数据包').props.disabled, true);
    pack.edit(pack.all('input').find(n => n.props.value === 'a'.repeat(129)), key);
    assert.equal(pack.button('下载数据包').props.disabled, false); counts.packEditing++;
  }
  pack.unmount();
}

const pending = mount('McWorkbench', { version: '26.1', catalog: catalogs['26.1'] }, { exportName: 'GiveTool' });
pending.edit(pending.all('select')[0], 'density'); pending.button('添加').props.onClick();
pending.edit(numberInputs(pending)[1], ''); assert.equal(pending.commands().length, 0);
pending.props({ version: '1.16.5', catalog: catalogs['1.16.5'] }); assert.ok(pending.commands()[0]);
pending.props({ version: '26.1', catalog: catalogs['26.1'] }); assert.equal(pending.commands().length, 0); assert.equal(numberInputs(pending)[1].props.value, '');
pending.edit(numberInputs(pending)[1], '12'); assert.match(pending.commands()[0], /minecraft:density':12/); pending.unmount(); counts.giveEditing += 4;

const validTargets = VALID_GIVE_TARGETS, invalidTargets = INVALID_GIVE_TARGETS;
for (const version of versions.filter(v => versionAtLeast(v, '1.20.5'))) {
  const expected = importGiveForRecipe(makeGiveCommand(give(version)), version, catalogs[version]);
  for (const target of validTargets) {
    const command = makeGiveCommand({ ...give(version), target });
    assert.deepEqual(importGiveForRecipe(command, version, catalogs[version]), expected, `${version}/${target}`);
    counts.selectorImport++;
  }
  for (const target of invalidTargets) {
    assert.throws(() => importGiveForRecipe(`/give ${target} minecraft:diamond_sword 1`, version, catalogs[version]), `${version}/${target}`);
    counts.selectorImport++;
  }
  for (const tail of ['[custom_name={text:\'x\'}] 1 garbage', '[custom_name={text:\'x\'}] 1 [unbreakable={}]', '[custom_name={text:\'x\'}] -1', '[custom_name={text:\'x\'}] 1.5']) {
    assert.throws(() => importGiveForRecipe(`/give @p[ distance=..10 ] minecraft:diamond_sword${tail}`, version, catalogs[version])); counts.selectorImport++;
  }
  for (const command of ['/give @p diamond_sword[unbreakable={}]2', '/give @p diamond_sword [unbreakable={}] 2', '/give @p minecraft:DIAMOND 1']) {
    assert.throws(() => importGiveForRecipe(command, version, catalogs[version])); counts.selectorImport++;
  }
  for (const command of ['/give @p diamond_sword[ unbreakable = {} ] 2', '/give @p diamond_sword[unbreakable={},] 2']) {
    assert.equal(importGiveForRecipe(command, version, catalogs[version]).count, 2); counts.selectorImport++;
  }
  if (versionAtLeast(version, '1.21.5')) for (const raw of ['a:b', '@a', '🦊', 'foo!', 'hi:type', '+0', '-0xF', '1f', 'bool(1)', '0xFF', '1ub']) {
    assert.throws(() => importGiveForRecipe(`/give @p diamond[custom_name={text:${raw}}]`, version, catalogs[version]), `${version}/${raw}`); counts.selectorImport++;
  }
  for (const space of ['\u00a0', '\u2007', '\u202f', '\ufeff']) {
    for (const source of [`/give${space}@p diamond 1`, `/give @p${space}diamond 1`, `/give @p diamond[${space}unbreakable={}] 1`, `/give @p diamond[custom_name={text:${space}'x'}] 1`, `/give @p diamond[unbreakable={}]${space}1`, `/give @p diamond 1${space}`]) {
      assert.throws(() => importGiveForRecipe(source, version, catalogs[version])); counts.selectorImport++;
    }
    if (versionAtLeast(version, '1.21.5')) {
      const parsed = importGiveForRecipe(`/give @p diamond[custom_name={text:'a${space}b'}] 1`, version, catalogs[version]);
      assert.equal(parsed.components['minecraft:custom_name'].text, `a${space}b`); counts.selectorImport++;
    }
  }

  const ui = mount('DataPackTool', { version, catalog: catalogs[version] });
  ui.edit(ui.all('textarea')[0], makeGiveCommand(give(version))); ui.button('导入 /give').props.onClick();
  const before = JSON.parse(ui.all('code')[0].props.children);
  ui.edit(ui.all('textarea')[0], '/give @p[bad=1] diamond 1'); ui.button('导入 /give').props.onClick();
  assert.ok(ui.all('p').some(n => n.props.role === 'alert')); assert.deepEqual(JSON.parse(ui.all('code')[0].props.children), before);
  ui.button('清除导入').props.onClick();
  assert.equal(ui.all('textarea')[0].props.value, ''); assert.ok(!ui.all('p').some(n => n.props.role === 'alert')); assert.equal(JSON.parse(ui.all('code')[0].props.children).result.components, undefined);
  ui.unmount(); counts.importRecovery += 3;
}

for (const version of MC_VERSIONS.filter(v => versionAtLeast(v, '1.21.5'))) for (const row of NBT_ORACLE_CASES) {
  assert.equal(compoundNbt(row.snbt, version), row.accepted && row.supported !== false, `${version}/${row.snbt}`);
  if (row.supported === false) assert.match(targetErrorHint(`@p[nbt=${row.snbt}]`, version, { playersOnly: true }), /暂不支持/);
  counts.nbtSyntax++;
}
const legacyCases = [['{v:128b}',true],['{v:[B;128b]}',false],['{v:[B;1b,-128b]}',true],['{v:[B;1]}',false],['{v:[I;1b]}',false],['{v:[L;1]}',false],['{v:[L;1L]}',true],['{v:[1,"a"]}',false],['{v:[1b,2]}',false],['{v:[1,2]}',true],['{v:"\\u0041"}',false],['{v:"\\n"}',false],['{v:bool(1)}',false],['{v:uuid("1-2-3-4-5")}',false],['{v:0xFF}',true],['{v:01}',true],['{v:[I;2147483648]}',false],['{v:[L;9223372036854775808L]}',false]];
for (const version of MC_VERSIONS.filter(v => !versionAtLeast(v, '1.21.5'))) for (const [snbt, accepted] of legacyCases) {
  assert.equal(compoundNbt(snbt, version), accepted, `${version}/${snbt}`); counts.nbtSyntax++;
}
for (const version of MC_VERSIONS) for (const space of ['\u00a0', '\u2007', '\u202f', '\ufeff']) {
  assert.equal(compoundNbt(`{a:${space}1}`, version), false);
  assert.equal(compoundNbt(`{a:'x${space}y'}`, version), true); counts.nbtSyntax += 2;
}
for (const version of versions) {
  const modern = versionAtLeast(version, '1.20.5');
  for (const lines of [255, 256, 257]) {
    const lore = Array.from({ length: lines }, (_, i) => `第${i}行`);
    const ui = mount('McWorkbench', { version, catalog: catalogs[version] }, { exportName: 'GiveTool' });
    ui.edit(ui.all('textarea')[0], lore.join('\n'));
    assert.equal(ui.commands().length, modern && lines > MAX_COMPONENT_LORE_LINES ? 0 : 1);
    if (modern && lines === 257) {
      assert.match(ui.text(), /最多支持 256 行/);
      assert.throws(() => makeGiveCommand({ ...give(version), lore }), /最多支持 256 行/);
      const entry = version === '1.20.6' ? JSON.stringify(JSON.stringify({ text: 'x' })) : "{text:'x'}";
      assert.throws(() => importGiveForRecipe(`/give @p diamond_sword[lore=[${Array.from({ length: lines }, () => entry).join(',')}]] 1`, version, catalogs[version]), /最多支持 256 行/);
      const rejected = createDataPackFiles({ ...packInput(version), resultComponents: { 'minecraft:lore': Array.from({ length: lines }, () => ({ text: 'x' })) } });
      assert.equal(rejected.files.length, 0); assert.ok(rejected.errors.some(e => e.includes('256')));
    } else {
      const command = makeGiveCommand({ ...give(version), lore });
      if (modern) assert.equal(importGiveForRecipe(command, version, catalogs[version]).components['minecraft:lore'].length, lines);
      assert.match(ui.text(), /这条指令较长/);
    }
    ui.unmount(); counts.loreBoundaries++;
  }
}

// Standard ZIP limits are byte counts, not character counts. Inspect separate
// local and central headers rather than trusting the writer's own metadata.
function inspectArchive(bytes, expected) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), decoder = new TextDecoder('utf-8', { fatal: true });
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50); assert.equal(view.getUint16(end + 8, true), expected.length); assert.equal(view.getUint16(end + 10, true), expected.length);
  let at = view.getUint32(end + 16, true);
  assert.equal(at + view.getUint32(end + 12, true), end);
  for (const file of expected) {
    assert.equal(view.getUint32(at, true), 0x02014b50); assert.equal(view.getUint16(at + 8, true), 0x0800);
    const length = view.getUint16(at + 28, true), local = view.getUint32(at + 42, true), size = view.getUint32(at + 24, true);
    assert.equal(decoder.decode(bytes.slice(at + 46, at + 46 + length)), file.name);
    assert.equal(view.getUint32(local, true), 0x04034b50); assert.equal(view.getUint16(local + 26, true), length);
    assert.equal(decoder.decode(bytes.slice(local + 30, local + 30 + length)), file.name);
    assert.equal(decoder.decode(bytes.slice(local + 30 + length, local + 30 + length + size)), file.content);
    assert.equal(view.getUint32(at + 16, true), view.getUint32(local + 14, true));
    at += 46 + length;
  }
  assert.equal(at, end);
}
for (const name of ['a'.repeat(65535), '界'.repeat(21845)]) {
  const files = [{ name, content: '中文 🐈‍⬛\n' }]; inspectArchive(zipFiles(files), files); counts.archiveBoundaries++;
}
for (const name of ['a'.repeat(65536), '界'.repeat(21846), 'a\0b', 'a//b', '/absolute', 'C:/absolute', 'a/../b', './a', 'a\\b']) {
  assert.throws(() => zipFiles([{ name, content: 'x' }])); counts.archiveBoundaries++;
}
assert.throws(() => zipFiles([{ name: 'same.json', content: '1' }, { name: 'same.json', content: '2' }]), /重复路径/); counts.archiveBoundaries++;
assert.throws(() => zipFiles(Array.from({ length: 65536 }, (_, i) => ({ name: `${i}.json`, content: 'x' }))), /数量/); counts.archiveBoundaries++;
const output = 'coverage/seventh-items-zips'; mkdirSync(output, { recursive: true }); const manifest = [];
for (const version of versions) for (const length of [1, 127, 128, 129]) {
  const generated = createDataPackFiles({ ...packInput(version), recipeName: 'r'.repeat(length), lootName: 'l'.repeat(length) });
  if (length > 128) { assert.equal(generated.files.length, 0); assert.equal(generated.errors.length, 2); }
  else {
    assert.equal(generated.errors.length, 0); const bytes = zipFiles(generated.files); inspectArchive(bytes, generated.files);
    const name = `${version}-${length}.zip`; writeFileSync(`${output}/${name}`, bytes);
    manifest.push({ name, files: generated.files });
  }
  counts.archiveBoundaries++;
}
writeFileSync(`${output}/manifest.json`, JSON.stringify(manifest));
writeFileSync('coverage/seventh-items-native-cases.json', JSON.stringify(MC_ITEM_NATIVE_FIXTURES));
console.log('Seventh items passed:', JSON.stringify(counts), 'total', Object.values(counts).reduce((a, b) => a + b, 0), `+ ${MC_ITEM_NATIVE_FIXTURES.length} official parser fixtures`);
