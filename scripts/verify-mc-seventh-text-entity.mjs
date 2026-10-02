import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadTs } from './mc-test-runtime.mjs';
import { mount } from './mc-interaction-runtime.mjs';

const require = createRequire(import.meta.url);
const minecraftData = require('minecraft-data');
const { MC_VERSIONS, versionAtLeast } = loadTs('../src/lib/mc/give.ts');
const { characters, remapTextColors, defaultTextStyle, coloredParts, textComponent } = loadTs('../src/lib/mc/textColors.ts');
const { importGiveForRecipe } = loadTs('../src/lib/mc/give-recipe.ts');
const { BANNER_COLORS, availableBannerPatterns, makeBannerCommand } = loadTs('../src/lib/mc/banner.ts');
const catalogs = Object.fromEntries(MC_VERSIONS.map(version => [version, JSON.parse(readFileSync(`public/mc-data/${version}.json`, 'utf8'))]));
const counts = { titleTimes: 0, titleChannels: 0, titleTargets: 0, unicodeEdits: 0, paintSelection: 0, literalText: 0, commandGuidance: 0, entityCoverage: 0, entityCommands: 0, staleCatalog: 0, entityCoordinates: 0, bannerStates: 0 };
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') : node?.props ? textOf(node.props.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
const numbers = ui => ui.all('input').filter(node => node.props.type === 'number');
const controls = (ui, label) => ui.nodes().find(node => node.props.label === label && node.props.onChange);
const readParts = (value, version) => {
  const parsed = versionAtLeast(version, '1.21.5')
    ? importGiveForRecipe(`/give @p diamond[custom_name={text:'',extra:${value.startsWith('[') ? value : `[${value}]`}}]`, version).components['minecraft:custom_name'].extra
    : JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [parsed];
};

for (const version of MC_VERSIONS) {
  const title = mount('TitleTool', { version });
  const actionbar = versionAtLeast(version, '1.11');
  assert.equal(title.all('input').some(node => node.props.maxLength === 100 && node.props.value === ''), actionbar);
  counts.titleChannels++;
  if (actionbar) {
    title.edit(title.all('input')[2], '旧版也能显示操作栏 👨‍👩‍👧‍👦');
    assert.ok(title.commands().some(command => command.startsWith('/title @a actionbar ')));
    counts.titleChannels++;
  }
  for (const index of [0, 1, 2]) {
    const original = numbers(title)[index].props.value;
    for (const bad of ['', '-0.05', '60.05']) {
      title.edit(numbers(title)[index], bad);
      assert.equal(numbers(title)[index].props.value, bad === '' ? '' : Number(bad));
      assert.ok(!title.commands().some(command => /^\/title @a (times|title|subtitle) /.test(command)));
      assert.match(title.text(), /完整填写 0 至 60 秒/);
      assert.equal(title.commands().filter(command => command.includes(' actionbar ')).length, actionbar ? 1 : 0);
      counts.titleTimes++;
      title.edit(numbers(title)[index], String(original));
      assert.ok(title.commands().some(command => command.startsWith('/title @a times ')));
      counts.titleTimes++;
    }
    for (const [seconds, ticks] of [['0', 0], ['0.05', 1], ['0.15', 3], ['1.25', 25], ['59.95', 1199], ['60', 1200]]) {
      title.edit(numbers(title)[index], seconds);
      const actual = title.commands().find(command => command.startsWith('/title @a times ')).split(' ').slice(3).map(Number);
      assert.equal(actual[index], ticks);
      counts.titleTimes++;
    }
    title.edit(numbers(title)[index], String(original));
  }
  if (actionbar) {
    title.button('操作栏').props.onClick();
    controls(title, '操作栏').props.onChange({ ...defaultTextStyle(), mode: 'alternate' });
    title.props({ version: '1.8.9' });
    assert.ok(!title.commands().some(command => command.includes(' actionbar ')));
    assert.ok(!title.all('button').some(node => textOf(node) === '操作栏'));
    title.props({ version });
    assert.ok(title.commands().some(command => command.includes(' actionbar ')));
    assert.equal(controls(title, '操作栏').props.style.mode, 'alternate');
    counts.titleChannels += 2;
  }
  for (const invalid of ['@a[foo=1]', '@a[x=NaN]', '@a[x=Infinity]', '@a[name=bad name]', '@e', '@a[', 'bad name']) {
    title.edit(title.all('input').find(node => node.props.value === '@a') ?? title.all('input').find(node => node.props.spellCheck === false), invalid);
    assert.equal(title.commands().length, 0, `${version}: unsafe target ${invalid}`);
    counts.titleTargets++;
    title.edit(title.all('input').find(node => node.props.spellCheck === false), '@a');
  }
  // Brigadier treats a newline inside the selector as legal Java whitespace.
  // Keep this explicit case; the older parser remains outside this capability.
  const whitespaceTarget = '@a[\n]';
  title.edit(title.all('input').find(node => node.props.spellCheck === false), whitespaceTarget);
  assert.equal(title.commands().length, versionAtLeast(version, '1.13') ? actionbar ? 4 : 3 : 0);
  if (versionAtLeast(version, '1.13')) assert.ok(title.commands().every(command => command.startsWith(`/title ${whitespaceTarget} `)));
  counts.titleTargets++;
  title.edit(title.all('input').find(node => node.props.spellCheck === false), '@a');
  if (versionAtLeast(version, '1.13')) {
    for (const target of ['@a[limit=1]', '@a[scores={kills=1..,deaths=..5}]', '@a[nbt={Inventory:[{id:"minecraft:diamond"}]}]', '@a[name="Pkqa player"]']) {
      title.edit(title.all('input').find(node => node.props.spellCheck === false), target);
      assert.equal(title.commands().length, actionbar ? 4 : 3);
      assert.ok(title.commands().every(command => command.startsWith(`/title ${target} `)));
      counts.titleTargets++;
    }
  }
  title.unmount();

  for (const tool of ['ColorTool', 'TitleTool']) {
    const ui = mount(tool, { version });
    const labels = tool === 'ColorTool' ? ['聊天文字'] : actionbar ? ['主标题', '副标题', '操作栏'] : ['主标题', '副标题'];
    for (const [channelIndex, label] of labels.entries()) {
      if (tool === 'TitleTool') ui.button(label).props.onClick();
      const input = () => tool === 'ColorTool' ? ui.all('textarea')[0] : ui.all('input')[channelIndex];
      for (const base of ['A👨‍👩‍👧‍👦B', 'AéB', 'A🇨🇳B', 'A👍🏽B', 'Aक्‍षB', 'A🐈‍⬛B']) {
        const clusters = characters(base);
        assert.equal(clusters.length, 3);
        for (const [next, caret, expected] of [[`X${base}`, 1, { 2: '#FF5555' }], [`${clusters[0]}X${clusters.slice(1).join('')}`, 2, { 2: '#FF5555' }], [clusters[0] + clusters[2], 1, {}]]) {
          ui.edit(input(), base);
          controls(ui, label).props.onChange({ ...defaultTextStyle(), mode: 'manual', overrides: { 1: '#FF5555' } });
          input().props.onChange({ target: { value: next, selectionStart: caret } });
          assert.deepEqual(controls(ui, label).props.style.overrides, expected, `${version}/${tool}/${label}/${base}`);
          assert.deepEqual(remapTextColors(base, next, { 1: '#FF5555' }, caret), expected);
          counts.unicodeEdits++;
        }
      }
      for (const message of ["引号'\"\\", '第一行\n第二行\t制表符', '\u0000\u0001\b\f\r', ' A\u00a0B ', '§c与&l不是自动格式', '👩🏽‍🚀🇨🇳é']) {
        ui.edit(input(), message);
        for (const mode of ['solid', 'gradient', 'alternate', 'manual']) {
          const style = { ...defaultTextStyle(), mode, overrides: { 1: '#FF5555' } };
          controls(ui, label).props.onChange(style);
          const raw = textComponent(coloredParts(message, style), version);
          assert.equal(readParts(raw, version).map(part => part.text).join(''), message);
          const container = ui.nodes().find(node => node.props.className === (tool === 'ColorTool' ? 'mc-chat-preview' : 'mc-title-preview'));
          assert.equal(textOf(container.props.children[tool === 'ColorTool' ? 1 : channelIndex]), message);
          counts.literalText++;
        }
      }
    }
    const input = () => tool === 'ColorTool' ? ui.all('textarea')[0] : ui.all('input')[0];
    if (tool === 'TitleTool') {
      ui.edit(ui.all('input')[1], '');
      if (actionbar) ui.edit(ui.all('input')[2], '');
      ui.button('主标题').props.onClick();
    }
    const label = tool === 'ColorTool' ? '聊天文字' : '主标题';
    ui.edit(input(), '');
    controls(ui, label).props.onChange(defaultTextStyle());
    assert.doesNotMatch(ui.text(), /较长指令建议/);
    ui.edit(input(), '渐变文字'.repeat(12));
    controls(ui, label).props.onChange({ ...defaultTextStyle(), mode: 'gradient' });
    assert.match(ui.text(), /较长指令建议放入命令方块执行/);
    assert.equal(ui.text().includes('写入 .mcfunction 文件'), versionAtLeast(version, '1.12'));
    counts.commandGuidance += 2;
    ui.unmount();
  }

  if (versionAtLeast(version, '1.16')) {
    const expected = minecraftData(version).entitiesArray.filter(({ name }) => /^[a-z0-9_]+$/.test(name) && !['player', 'fishing_bobber'].includes(name));
    const actualNames = new Set(catalogs[version].entities.map(entity => entity.name));
    for (const entity of expected) {
      // These registries include future experimental entries. The stable-site
      // filtering stays intentionally stricter than protocol availability.
      const experimental = ['1.20.4', '1.20.6'].includes(version) && !minecraftData('1.20.2').entitiesByName[entity.name] && !(version === '1.20.6' && entity.name === 'armadillo');
      assert.equal(actualNames.has(entity.name), !experimental, `${version}: missing ${entity.name}`);
      counts.entityCoverage++;
    }
    assert.ok(!actualNames.has('player') && !actualNames.has('fishing_bobber'));
    assert.equal(actualNames.size, catalogs[version].entities.length);
    counts.entityCoverage += 2;
  }
  if (versionAtLeast(version, '1.12')) {
    const catalog = catalogs[version], summon = mount('SummonTool', { version, catalog });
    for (const entity of catalog.entities) {
      for (const id of [entity.name, ` MINECRAFT:${entity.name.toUpperCase()} `]) {
        summon.edit(summon.all('input')[0], id);
        const entityData = entity.name === 'item' ? ` {Item:{id:"minecraft:stone",${versionAtLeast(version, '1.20.5') ? 'count:1' : 'Count:1b'}}}` : '';
        assert.equal(summon.commands()[0], `/summon minecraft:${entity.name} ~ ~ ~${entityData}`);
        const hasEgg = catalog.items.some(item => item.name === `${entity.name}_spawn_egg`);
        assert.equal(summon.commands().length, hasEgg ? 2 : 1);
        assert.ok(summon.text().includes(entity.displayNameZh));
        if (entity.name === 'item') assert.match(summon.text(), /生成 1 个石头掉落物/);
        if (['painting', 'item_frame', 'glow_item_frame', 'leash_knot'].includes(entity.name)) assert.match(summon.text(), /支撑方块及可用空间/);
        counts.entityCommands++;
      }
    }
    summon.edit(summon.all('input')[0], 'zombie');
    summon.button('指定绝对坐标').props.onClick();
    for (const [point, command] of [[[' 0 ', ' 64 ', ' -1 '], '/summon minecraft:zombie 0 64 -1'], [['-0000', '0064', '-0001'], '/summon minecraft:zombie 0 64 -1'], [['', '64', '0'], null], [['0', '', '0'], null], [['0', '64', '1.5'], null], [['30000000', '64', '0'], null], [['-30000000', '64', '29999999'], '/summon minecraft:zombie -30000000 64 29999999']]) {
      point.forEach((value, index) => summon.edit(numbers(summon)[index], value));
      assert.equal(summon.commands().find(value => value.startsWith('/summon')) ?? null, command);
      counts.entityCoordinates++;
    }
    summon.unmount();
    const stale = { ...catalog, entities: [...catalog.entities, ...['player', 'fishing_bobber'].map(name => ({ name, displayName: name, displayNameZh: name, type: 'mob' }))] };
    const guarded = mount('SummonTool', { version, catalog: stale });
    for (const id of ['player', 'fishing_bobber']) {
      guarded.edit(guarded.all('input')[0], id);
      assert.equal(guarded.commands().length, 0);
      assert.ok(!guarded.all('option').some(node => node.props.value === id));
      counts.staleCatalog++;
    }
    guarded.unmount();
  }

  if (versionAtLeast(version, '1.16')) {
    const banner = mount('BannerTool', { version });
    banner.button('盾牌 Shield').props.onClick();
    for (const color of BANNER_COLORS) {
      banner.all('button').find(node => node.props['aria-label'] === `底色 ${color.zh}`).props.onClick();
      const command = banner.commands()[0];
      assert.ok(command.includes('minecraft:shield'));
      assert.ok(versionAtLeast(version, '1.20.5') ? command.includes(`base_color=${color.id}`) : command.includes(`Base:${BANNER_COLORS.findIndex(entry => entry.id === color.id)}`));
      counts.bannerStates++;
    }
    while (banner.button('×')) banner.button('×').props.onClick();
    assert.equal(banner.commands()[0], makeBannerCommand({ version, target: 'shield', base: 'black', layers: [] }));
    const pattern = availableBannerPatterns(version)[0][0];
    assert.doesNotMatch(banner.text(), /较长指令建议/);
    for (let index = 0; index < 16; index++) banner.all('button').find(node => node.key === pattern).props.onClick();
    assert.match(banner.text(), /较长指令建议放入命令方块执行/);
    counts.commandGuidance += 2;
    assert.ok(banner.all('button').filter(node => availableBannerPatterns(version).some(([id]) => id === node.key)).every(node => node.props.disabled));
    banner.all('button').find(node => node.props['aria-label'] === '删除第 16 层').props.onClick();
    assert.ok(!banner.all('button').find(node => node.key === pattern).props.disabled);
    counts.bannerStates += 3;
    banner.unmount();
  }
}

let selectionStyle = { ...defaultTextStyle(), mode: 'manual' };
const selectionProps = text => ({ text, label: '组合字符', style: selectionStyle, onChange(next) { selectionStyle = next; } });
const selection = mount('TextStyleControls', selectionProps('A👨‍👩‍👧‍👦🇨🇳é中'));
const charButton = index => selection.all('button').find(node => node.props['aria-label']?.startsWith(`第 ${index + 1} 字 `));
assert.equal(selection.all('button').filter(node => node.props['aria-label']?.startsWith('第 ')).length, 5);
charButton(1).props.onClick({ shiftKey: false });
charButton(3).props.onClick({ shiftKey: false });
selection.all('button').find(node => node.props['aria-label'] === '应用颜色 #FF5555').props.onClick();
assert.deepEqual(selectionStyle.overrides, { 1: '#FF5555', 3: '#FF5555' });
selection.props(selectionProps('A👨‍👩‍👧‍👦🇨🇳é中'));
charButton(4).props.onClick({ shiftKey: true });
selection.all('button').find(node => node.props['aria-label'] === '应用颜色 #55FFFF').props.onClick();
assert.deepEqual(selectionStyle.overrides, { 1: '#FF5555', 3: '#55FFFF', 4: '#55FFFF' });
selection.props(selectionProps('A👨‍👩‍👧‍👦🇨🇳é中'));
charButton(1).props.onClick({ shiftKey: true });
assert.deepEqual(selection.all('button').filter(node => node.props['aria-label']?.startsWith('第 ') && node.props['aria-pressed']).map(node => node.props['aria-label']), ['第 2 字 👨‍👩‍👧‍👦', '第 3 字 🇨🇳', '第 4 字 é']);
selection.button('清除逐字颜色').props.onClick();
assert.deepEqual(selectionStyle.overrides, {});
selection.props(selectionProps(''));
selection.all('button').find(node => node.props['aria-label'] === '应用颜色 #55FFFF').props.onClick();
assert.deepEqual(selectionStyle.overrides, {});
selection.unmount();
counts.paintSelection += 6;

assert.equal(catalogs['26.1'].entities.length, 155, 'Official 26.1 canSummon audit expects 155 supported entity types');
counts.entityCoverage++;
console.log('Seventh text/entity pass passed:', JSON.stringify(counts), 'total', Object.values(counts).reduce((sum, count) => sum + count, 0));
