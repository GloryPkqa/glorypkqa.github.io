import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./mc-test-runtime.mjs";
import { mount, flush, respond } from "./mc-interaction-runtime.mjs";

const { MC_VERSIONS, versionAtLeast } = loadTs("../src/lib/mc/give.ts");
const { importGiveForRecipe } = loadTs("../src/lib/mc/give-recipe.ts");
const counts = { titleWhitespace: 0, literalText: 0, directions: 0, numericBoundaries: 0, fillModes: 0, clock: 0, clipboard: 0, keyboard: 0, capeRecovery: 0 };
const catalogs = Object.fromEntries(MC_VERSIONS.map(v => [v, JSON.parse(readFileSync(new URL(`../public/mc-data/${v}.json`, import.meta.url), "utf8"))]));
const textOf = node => Array.isArray(node) ? node.map(textOf).join("") : node?.props ? textOf(node.props.children) : typeof node === "string" || typeof node === "number" ? String(node) : "";
function decodeText(value, version) {
  return versionAtLeast(version, "1.21.5")
    ? importGiveForRecipe(`/give @p diamond[custom_name={text:'',extra:${value.startsWith("[") ? value : `[${value}]`}}]`, version).components["minecraft:custom_name"].extra
    : JSON.parse(value);
}
const entries = value => Array.isArray(value) ? value : [value];

for (const version of MC_VERSIONS) {
  const ui = mount("TitleTool", { version });
  const channels = versionAtLeast(version, "1.16") ? ["主标题", "副标题", "操作栏"] : ["主标题", "副标题"];
  for (const [index, label] of channels.entries()) for (const text of [" A ", "  中文  ", " é 👨‍👩‍👧‍👦 "]) for (const mode of ["solid", "gradient", "alternate", "manual"]) {
    ui.edit(ui.all("input")[index], text); ui.button(label).props.onClick();
    const controls = ui.nodes().find(n => n.props.label === label && n.props.onChange);
    controls.props.onChange({ ...controls.props.style, mode, colorA: "#FFFFFF", colorB: "#FF5555", overrides: { 1: "#FF5555" } });
    const channel = ["title", "subtitle", "actionbar"][index];
    const command = ui.commands().find(c => c.startsWith(`/title @a ${channel} `));
    const parts = entries(decodeText(command.slice(`/title @a ${channel} `.length), version));
    assert.equal(parts.map(p => p.text).join(""), text, `${version}/${channel}/${mode}: lost whitespace`);
    if (mode === "manual") assert.equal(parts.find(p => p.color === (versionAtLeast(version, "1.16") ? "#FF5555" : "red")).text, [...new Intl.Segmenter(undefined, {granularity:"grapheme"}).segment(text)][1].segment);
    const preview = ui.nodes().find(n => n.props.className === "mc-title-preview");
    assert.equal(textOf(preview.props.children[index]), text);
    counts.titleWhitespace++;
  }
  ui.unmount();
  const colors = mount("ColorTool", { version });
  for (const text of ["价格§10", "§c红色", "第一行\n第二行", " A  B ", "引号'\"与\\", "制表\t符", "👨‍👩‍👧‍👦 é 🇨🇳", "插件&c文字"]) {
    colors.edit(colors.all("textarea")[0], text);
    const parts = entries(decodeText(colors.commands()[0].slice("/tellraw @a ".length), version));
    assert.equal(parts.map(p => p.text).join(""), text);
    assert.equal(textOf(colors.nodes().find(n => n.props.className === "mc-chat-preview").props.children[1]), text);
    counts.literalText++;
  }
  colors.unmount();
  const coordinate = mount("CoordinateTool", { version });
  [0, 0, 0].forEach((v, i) => coordinate.edit(coordinate.all("input")[i], String(v)));
  for (const [x, y, z, expected] of [[0,0,1,"南"],[-1,0,1,"西南"],[-1,0,0,"西"],[-1,0,-1,"西北"],[0,0,-1,"北"],[1,0,-1,"东北"],[1,0,0,"东"],[1,0,1,"东南"],[0,1,0,"正上方"],[0,-1,0,"正下方"],[0,0,0,"已经到达目标"]]) {
    [x,y,z].forEach((v, i) => coordinate.edit(coordinate.all("input")[i+3], String(v)));
    const stats = coordinate.nodes().find(n => n.props.className === "mc-route-stats");
    assert.equal(textOf(stats.props.children[2].props.children[1]), expected);
    assert.equal(textOf(stats.props.children[0].props.children[1]).replace("格", ""), Math.hypot(x,z).toFixed(1) + " ");
    counts.directions++;
  }
  for (const [value, expected] of [["-0.1", -1],["-8", -1],["-8.01", -2],["7.99",0],["8",1]]) {
    coordinate.edit(coordinate.all("input")[0], value);
    assert.equal(coordinate.commands()[0], `/tp ${version === "1.8.9" ? "@p" : "@s"} ${expected} 0 0`); counts.numericBoundaries++;
  }
  for (const value of ["", "NaN", "Infinity", "1e308", "--1"]) {
    coordinate.edit(coordinate.all("input")[0], value); assert.equal(coordinate.commands().length, 0); counts.numericBoundaries++;
  }
  coordinate.unmount();
  const effect = mount("EffectTool", { catalog: catalogs[version] });
  effect.edit(effect.all("input").find(n => n.props.type === "checkbox"), true);
  for (const [value, seconds] of [["1.5",1],["0.1",1],["0",1],["-5",1],["9999999",1000000],["60",60]]) {
    effect.edit(effect.all("input").find(n => n.props.type === "number"), value);
    assert.equal(effect.all("input").find(n => n.props.type === "number").props.value, seconds);
    assert.match(effect.commands()[0], new RegExp(`[dD]uration:${seconds * 20}[,}]`)); counts.numericBoundaries++;
  }
  effect.edit(effect.all("input").find(n => n.props.type === "number"), "");
  assert.equal(effect.all("input").find(n => n.props.type === "number").props.value, "");
  assert.equal(effect.commands().filter(command => command.startsWith("/give ")).length, 0);
  assert.equal(effect.nodes().find(n => n.props.className === "mc-copy-button").props.disabled, true);
  counts.numericBoundaries++;
  effect.unmount();
  const block = mount("BlockTool", { version, catalog: catalogs[version] });
  block.nodes().find(n => n.props.label === "起点").props.onChange(["-2","-2","-2"]);
  block.nodes().find(n => n.props.label === "终点").props.onChange(["-4","-4","-4"]);
  assert.match(block.text(), /区域体积 27 格/);
  for (const set of ["replace","keep","destroy"]) for (const fill of ["replace","keep","destroy","hollow","outline"]) {
    block.edit(block.all("select")[0], set); block.edit(block.all("select")[1], fill);
    const legacy = !versionAtLeast(version, "1.13");
    assert.deepEqual(block.commands(), [
      `/setblock -2 -2 -2 minecraft:stone${legacy ? ` 0 ${set}` : set === "replace" ? "" : ` ${set}`}`,
      `/fill -2 -2 -2 -4 -4 -4 minecraft:stone${legacy ? ` 0 ${fill}` : fill === "replace" ? "" : ` ${fill}`}`,
    ]); counts.fillModes++;
  }
  block.unmount();
}

const world = mount("WorldTool");
for (const tick of Array.from({length:97}, (_,i) => Math.min(23999,i*250))) {
  world.edit(world.all("input")[0], String(tick));
  const totalMinutes = Math.floor(tick / 1000 * 60 + 360) % 1440;
  const expected = `${String(Math.floor(totalMinutes/60)).padStart(2,"0")}:${String(totalMinutes%60).padStart(2,"0")}`;
  assert.equal(textOf(world.nodes().find(n => n.props.className === "mc-world-preview").props.children[1]), expected); counts.clock++;
}
world.unmount();

// Delayed permission prompts, changed commands, denial, out-of-order replies,
// and the older timer expiring after a second successful copy.
const clipboard = [];
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: value => new Promise((resolve,reject) => clipboard.push({value,resolve,reject})) } } });
const fixtures = [
  ["ColorTool",{version:"26.1"}, ui => ui.edit(ui.all("textarea")[0],"new text")],
  ["CoordinateTool",{version:"26.1"},ui => ui.edit(ui.all("input")[0],"1600")],
  ["TitleTool",{version:"26.1"},ui => ui.edit(ui.all("input").find(n=>n.props.type==="number"),"1")],
  ["BlockTool",{version:"26.1",catalog:catalogs["26.1"]},ui => ui.edit(ui.all("input")[0],"dirt")],
  ["SummonTool",{version:"26.1",catalog:catalogs["26.1"]},ui => ui.edit(ui.all("input")[0],"creeper")],
  ["WorldTool",{},ui => ui.edit(ui.all("input")[0],"6000")],
  ["EffectTool",{catalog:catalogs["26.1"]},ui => ui.edit(ui.all("select")[0],"strength")],
  ["BannerTool",{version:"26.1"},ui => ui.all("button").find(n=>n.props["aria-label"]==="底色 白色").props.onClick()],
  ["McWorkbench",{value:"/give @p diamond 1"},ui => ui.props({value:"/give @p stone 1"}),{exportName:"CopyButton"}],
];
for (const [name,props,change,options] of fixtures) {
  const ui = mount(name,props,options);
  const copyButton = () => ui.all("button").find(n => n.props.className === "mc-copy-button");
  copyButton().props.onClick(); const first = clipboard.at(-1); change(ui); first.resolve(); await flush();
  assert.notEqual(textOf(copyButton()),"已复制 ✓",name); counts.clipboard++;
  copyButton().props.onClick(); const second = clipboard.at(-1); second.resolve(); await flush();
  assert.equal(textOf(copyButton()),"已复制 ✓",name); counts.clipboard++;
  const oldTimer = [...ui.timers.values()].find(t=>t.delay===1600).callback;
  copyButton().props.onClick(); const third = clipboard.at(-1); third.resolve(); await flush(); oldTimer();
  assert.equal(textOf(copyButton()),"已复制 ✓",name); counts.clipboard++;
  ui.tick(1600); assert.notEqual(textOf(copyButton()),"已复制 ✓"); counts.clipboard++;
  copyButton().props.onClick(); const fourth=clipboard.at(-1); copyButton().props.onClick(); const fifth=clipboard.at(-1);
  fifth.resolve(); await flush(); fourth.reject(new Error("old denial")); await flush();
  assert.equal(textOf(copyButton()),"已复制 ✓"); counts.clipboard++;
  copyButton().props.onClick(); clipboard.at(-1).reject(new Error("denied")); await flush();
  assert.notEqual(textOf(copyButton()),"已复制 ✓"); counts.clipboard++;
  copyButton().props.onClick(); const last=clipboard.at(-1); ui.unmount(); last.resolve(); await flush();
  assert.equal([...ui.timers.values()].filter(t=>t.delay===1600).length,0); counts.clipboard++;
}
const player=mount("PlayerLookup"); player.tick(0); respond(player.requests[0],{data:{player:{username:"Pkqa",id:"pkqa-uuid"}}}); await flush();
player.button("复制 UUID").props.onClick(); const old=clipboard.at(-1);
player.edit(player.all("input")[0],"Notch"); player.submit(); respond(player.requests[1],{data:{player:{username:"Notch",id:"notch-uuid"}}}); await flush(); old.resolve(); await flush();
assert.equal(textOf(player.button("复制 UUID")),"复制 UUID ↗"); player.unmount(); counts.clipboard++;

// Hidden links cannot receive keyboard focus; reduced-motion applies to both.
let scrollListener;
let removed = false;
const scrolls = [];
const quick=mount("McWorkbench",{}, {exportName:"QuickReturn",setupWindow(win){
  win.scrollY=0; win.addEventListener=(_,f)=>{scrollListener=f;}; win.removeEventListener=()=>{removed=true;};
}});
assert.equal(quick.all("nav")[0].props["aria-hidden"],true);
assert.ok(quick.all("a").every(n=>n.props.tabIndex===-1)); counts.keyboard++;
window.scrollY=900; scrollListener();
assert.equal(quick.all("nav")[0].props["aria-hidden"],false);
assert.ok(quick.all("a").every(n=>n.props.tabIndex===0)); counts.keyboard++;
window.matchMedia=()=>({matches:true}); window.history={pushState(){}}; window.scrollTo=opts=>scrolls.push(opts);
globalThis.document={getElementById:()=>({scrollIntoView:opts=>scrolls.push(opts)})};
for(const link of quick.all("a")) link.props.onClick({preventDefault(){}});
assert.deepEqual(scrolls.map(s=>s.behavior),["instant","instant"]); counts.keyboard++;
assert.equal(typeof scrollListener,"function");
quick.unmount(); assert.equal(removed,true); counts.keyboard++;

// WebGL failure must not permanently suppress the canvas for a new texture.
let fail=true, disposed=0;
class Viewer { constructor(){this.playerObject={rotation:{}};} loadSkin(){return fail?Promise.reject(new Error("texture failure")):Promise.resolve();} loadCape(){return Promise.resolve();} render(){} dispose(){disposed++;} }
globalThis.ResizeObserver=class {observe(){} disconnect(){}};
const cape=mount("CapePreview",{skinUrl:"skin-a",capeUrl:"cape-a",playerName:"A"},{imports:{skinview3d:{SkinViewer:Viewer}}});
cape.all("canvas")[0].props.ref.current={}; cape.all("div")[0].props.ref.current={clientWidth:100,clientHeight:150}; await flush();
assert.equal(cape.all("canvas")[0].props.hidden,true); assert.equal(cape.all("img").length,1); assert.equal(disposed,1); counts.capeRecovery++;
fail=false; cape.props({skinUrl:"skin-b",capeUrl:"cape-b",playerName:"B"}); await flush();
assert.equal(cape.all("canvas")[0].props.hidden,false); assert.equal(cape.all("img").length,0); cape.unmount(); assert.equal(disposed,2); counts.capeRecovery++;

console.log("Third-pass MC checks passed:",JSON.stringify(counts),"total",Object.values(counts).reduce((a,b)=>a+b,0));
