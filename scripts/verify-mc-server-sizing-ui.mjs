import assert from "node:assert/strict";
import { mount, flush } from "./mc-interaction-runtime.mjs";

const versions = ["26.1", "1.21.8", "1.21.5", "1.20.6", "1.20.4", "1.17", "1.16.5", "1.12.2", "1.8.9"];
const counts = { versions: 0, validation: 0, lifecycle: 0, controls: 0, copy: 0, downloads: 0 };
const text = (node) => Array.isArray(node) ? node.map(text).join("") : node?.props ? text(node.props.children) : typeof node === "string" || typeof node === "number" ? String(node) : "";
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const controls = (ui) => ui.nodes().filter((node) => typeof node.type === "function" && ["NumberInput", "SelectInput"].includes(node.type.name)).flatMap((node) => nodes(node.type(node.props)));
const field = (ui, key) => controls(ui).find((node) => node.props["data-sizing-field"] === key);
const generated = (ui) => !ui.button("复制配置报告").props.disabled;
const reportText = (ui) => text(ui.all("pre")[0]);
const focus = [];
globalThis.document = { getElementById: (id) => ({ focus: () => focus.push(id) }) };

for (const version of versions) {
  const ui = mount("ServerSizingTool", { version });
  assert.ok(!generated(ui));
  assert.ok(ui.button("下载报告").props.disabled);
  assert.equal(field(ui, "concurrentPlayers").props.value, "");
  assert.equal(field(ui, "totalPlayers").props.value, "");
  const modern = ["26.1", "1.21.8", "1.21.5", "1.20.6", "1.20.4"].includes(version);
  assert.equal(!!field(ui, "simulationDistance"), modern);
  if (!modern) assert.match(ui.text(), /按你填写的视距估算模拟范围/);
  ui.edit(field(ui, "concurrentPlayers"), "5");
  ui.edit(field(ui, "totalPlayers"), "15");
  assert.ok(!generated(ui), "Reports must not automatically appear for valid input");
  ui.submit();
  assert.ok(generated(ui), `${version}: ${ui.text()}`);
  assert.equal(ui.all("article").length, 6);
  assert.ok(reportText(ui).includes(version));
  assert.doesNotMatch(reportText(ui), /NaN|Infinity|undefined/);
  assert.match(ui.text(), /原版运行时参考/);
  ui.edit(field(ui, "concurrentPlayers"), "");
  assert.equal(field(ui, "concurrentPlayers").props.value, "");
  assert.ok(!generated(ui));
  assert.ok(ui.button("下载报告").props.disabled);
  assert.match(ui.text(), /输入已变化/);
  ui.edit(field(ui, "concurrentPlayers"), "5");
  assert.ok(!generated(ui), "Returning to an old input must still require explicit regeneration");
  ui.submit();
  assert.ok(generated(ui));
  counts.versions += 17 + (modern ? 0 : 1);
  ui.unmount();
}

{
  const ui = mount("ServerSizingTool", { version: "26.1" });
  ui.submit();
  assert.ok(!generated(ui));
  assert.equal(field(ui, "concurrentPlayers").props["aria-invalid"], true);
  assert.equal(field(ui, "totalPlayers").props["aria-invalid"], true);
  assert.equal(focus.at(-1), "mc-sizing-concurrentPlayers");
  ui.edit(field(ui, "concurrentPlayers"), "10");
  ui.edit(field(ui, "totalPlayers"), "5");
  ui.submit();
  assert.ok(!generated(ui));
  assert.equal(field(ui, "totalPlayers").props["aria-invalid"], true);
  ui.edit(field(ui, "totalPlayers"), "30");
  ui.edit(field(ui, "simulationDistance"), "33");
  ui.submit();
  assert.ok(!generated(ui));
  assert.equal(field(ui, "simulationDistance").props["aria-invalid"], true);
  assert.equal(focus.at(-1), "mc-sizing-simulationDistance");
  ui.edit(field(ui, "simulationDistance"), "8");
  ui.edit(field(ui, "currentWorldGiB"), "-1");
  ui.submit();
  assert.ok(!generated(ui));
  assert.equal(field(ui, "currentWorldGiB").props["aria-invalid"], true);
  ui.edit(field(ui, "currentWorldGiB"), "0");
  ui.edit(field(ui, "dailyGrowthGiB"), "0");
  ui.submit();
  assert.ok(generated(ui));
  ui.edit(field(ui, "currentWorldGiB"), "");
  ui.edit(field(ui, "dailyGrowthGiB"), "");
  ui.submit();
  assert.ok(generated(ui));
  counts.validation += 13;
  ui.unmount();
}

{
  const ui = mount("ServerSizingTool", { version: "26.1" });
  ui.button("载入 10 人示例").props.onClick();
  assert.equal(field(ui, "concurrentPlayers").props.value, 10);
  assert.ok(!generated(ui), "Loading a sample does not generate a report");
  assert.ok(field(ui, "pluginCount"));
  assert.ok(!field(ui, "modCount"));
  ui.submit();
  assert.ok(generated(ui));
  ui.props({ version: "1.8.9" });
  assert.ok(!generated(ui));
  assert.ok(!field(ui, "simulationDistance"));
  ui.props({ version: "26.1" });
  assert.ok(!generated(ui), "Returning to an old version must not restore an old report");
  ui.submit();
  assert.ok(generated(ui));
  ui.button("模组服").props.onClick();
  assert.ok(!generated(ui));
  assert.ok(field(ui, "modCount"));
  assert.ok(!field(ui, "pluginCount"));
  ui.edit(field(ui, "modCount"), "");
  ui.submit();
  assert.ok(!generated(ui));
  ui.button("原版服").props.onClick();
  ui.submit();
  assert.ok(generated(ui), "A hidden mod count must not break vanilla sizing");
  ui.button("混合服").props.onClick();
  assert.equal(field(ui, "modCount").props.value, "", "Preserve editable state when switching back");
  assert.ok(field(ui, "pluginCount"));
  ui.edit(field(ui, "modCount"), "50");
  ui.submit();
  assert.ok(generated(ui));
  counts.lifecycle += 17;

  for (const [key, value] of [
    ["extraLoad", "heavy"], ["redstone", "extreme"], ["spread", "scattered"],
    ["exploration", "extreme"], ["pregeneration", "full"], ["pregenRadiusBlocks", "5000"],
    ["worldCount", "2"], ["dimensionCount", "4"], ["cycleDays", "180"],
    ["runningHoursPerDay", "12"], ["playerHoursPerDay", "2"], ["joinsPerHour", "25"],
    ["residentEntities", "5000"], ["backupCopies", "7"], ["backupIntervalHours", "6"],
    ["backupLocation", "both"], ["resourcePackMiB", "100"], ["resourcePackHosting", "same-server"],
    ["networkQuality", "poor"], ["targetRegion", "cross-region"], ["physicalMemoryGiB", "4"], ["uploadMbps", "10"],
    ["permanentChunks", "500"], ["otherServicesGiB", "2"],
  ]) {
    ui.edit(field(ui, key), value);
    assert.ok(!generated(ui), `${key} must invalidate old report`);
    assert.equal(field(ui, key).props.value, value);
    ui.submit();
    assert.ok(generated(ui), `${key}: ${ui.text()}`);
    assert.doesNotMatch(reportText(ui), /NaN|Infinity|undefined/);
    counts.controls += 4;
  }
  ui.button("创造 / 建筑").props.onClick();
  assert.ok(!generated(ui));
  ui.submit();
  assert.ok(generated(ui));
  counts.controls += 2;
  ui.unmount();
}

const clipboard = [];
{
  const ui = mount("ServerSizingTool", { version: "26.1" });
  ui.button("载入 10 人示例").props.onClick(); ui.submit();
  assert.ok(generated(ui));
  assert.match(text(ui.nodes().find((node) => node.props.role === "status")), /报告已生成/);
  // These events reproduce a native unfinished exponent, not a mocked NaN.
  field(ui, "currentWorldGiB").props.onChange({ target: { value: "", validity: { badInput: true } } });
  assert.equal(field(ui, "currentWorldGiB").props.value, "");
  assert.ok(!generated(ui));
  ui.submit();
  assert.ok(!generated(ui));
  assert.equal(field(ui, "currentWorldGiB").props["aria-invalid"], true);
  assert.equal(focus.at(-1), "mc-sizing-currentWorldGiB");
  assert.match(text(ui.nodes().find((node) => node.props.role === "status")), /原报告已停用/);
  field(ui, "currentWorldGiB").props.onChange({ target: { value: "", validity: { badInput: false } } });
  assert.ok(!generated(ui), "Clearing badInput still requires explicit regeneration");
  ui.submit(); assert.ok(generated(ui), "A truly empty optional field is valid");

  // Submission scans native form controls even if an empty onChange was missed.
  ui.all("form")[0].props.onSubmit({ preventDefault() {}, currentTarget: { elements: [{ type: "number", dataset: { sizingField: "uploadMbps" }, validity: { badInput: true } }] } });
  assert.ok(!generated(ui));
  assert.equal(field(ui, "uploadMbps").props["aria-invalid"], true);
  assert.equal(focus.at(-1), "mc-sizing-uploadMbps");
  ui.all("form")[0].props.onSubmit({ preventDefault() {}, currentTarget: { elements: [{ type: "number", dataset: { sizingField: "uploadMbps" }, validity: { badInput: false } }] } });
  assert.ok(generated(ui));
  assert.equal(field(ui, "uploadMbps").props["aria-invalid"], false);

  field(ui, "pluginCount").props.onChange({ target: { value: "", validity: { badInput: true } } });
  ui.button("原版服").props.onClick(); ui.submit();
  assert.ok(generated(ui), "Hidden native-invalid plugin input must not affect vanilla");
  ui.button("插件服").props.onClick(); ui.submit();
  assert.ok(!generated(ui), "The newly visible required count remains incomplete");
  ui.edit(field(ui, "pluginCount"), "10"); ui.submit();
  assert.ok(generated(ui));
  field(ui, "simulationDistance").props.onChange({ target: { value: "", validity: { badInput: true } } });
  ui.props({ version: "1.8.9" }); ui.submit();
  assert.ok(generated(ui), "Hidden simulation input must not affect an old version");
  ui.props({ version: "26.1" }); ui.submit();
  assert.ok(!generated(ui));
  counts.validation += 20;
  ui.unmount();
}

Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: (value) => new Promise((resolve, reject) => clipboard.push({ value, resolve, reject })) } } });
{
  const ui = mount("ServerSizingTool", { version: "26.1" });
  ui.button("载入 10 人示例").props.onClick(); ui.submit();
  ui.button("复制配置报告").props.onClick();
  assert.equal(clipboard.at(-1).value, reportText(ui));
  clipboard.at(-1).reject(new Error("denied")); await flush();
  assert.match(ui.text(), /复制失败/);
  ui.edit(field(ui, "concurrentPlayers"), "12");
  assert.doesNotMatch(ui.text(), /复制失败/);
  assert.ok(ui.button("复制配置报告").props.disabled);
  ui.submit(); ui.button("复制配置报告").props.onClick();
  clipboard.at(-1).resolve(); await flush();
  assert.match(ui.text(), /已复制/);
  counts.copy += 5;
  ui.unmount();
}

const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
const created = [], revoked = [], links = [];
URL.createObjectURL = (blob) => { const url = `blob:sizing-${created.length}`; created.push({ url, blob }); return url; };
URL.revokeObjectURL = (url) => revoked.push(url);
document.body = { append(link) { link.appended = true; } };
document.createElement = () => { const link = { click() { this.clicked = true; }, remove() { this.removed = true; } }; links.push(link); return link; };
try {
  {
    const ui = mount("ServerSizingTool", { version: "1.16.5" });
    ui.button("载入 10 人示例").props.onClick(); ui.submit();
    ui.button("下载报告").props.onClick();
    const link = links.at(-1), downloaded = created.at(-1);
    assert.ok(link.appended && link.clicked && link.removed);
    assert.equal(link.download, "pkqa-server-sizing-1_16_5.txt");
    assert.equal(await downloaded.blob.text(), reportText(ui));
    assert.match(ui.text(), /报告已准备下载/);
    ui.edit(field(ui, "concurrentPlayers"), "12");
    assert.doesNotMatch(ui.text(), /报告已准备下载/);
    assert.ok(ui.button("下载报告").props.disabled);
    ui.tick(60_000);
    assert.ok(revoked.includes(downloaded.url));
    ui.unmount();
    counts.downloads += 7;
  }
  {
    const ui = mount("ServerSizingTool", { version: "26.1" });
    ui.button("载入 10 人示例").props.onClick(); ui.submit();
    ui.button("下载报告").props.onClick();
    const downloaded = created.at(-1);
    ui.unmount();
    assert.ok(revoked.includes(downloaded.url));
    counts.downloads++;
  }
  {
    const ui = mount("ServerSizingTool", { version: "26.1" });
    ui.button("载入 10 人示例").props.onClick(); ui.submit();
    const oldAppend = document.body.append;
    document.body.append = () => { throw new Error("blocked"); };
    ui.button("下载报告").props.onClick();
    assert.match(ui.text(), /下载失败/);
    assert.ok(revoked.includes(created.at(-1).url));
    assert.ok(links.at(-1).removed);
    document.body.append = oldAppend;
    ui.edit(field(ui, "totalPlayers"), "50");
    assert.doesNotMatch(ui.text(), /下载失败/);
    counts.downloads += 4;
    ui.unmount();
  }
} finally {
  URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
}

console.log("Server sizing UI verified:", JSON.stringify(counts), "total", Object.values(counts).reduce((sum, value) => sum + value, 0));
