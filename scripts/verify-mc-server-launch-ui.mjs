import assert from "node:assert/strict";
import { mount, flush } from "./mc-interaction-runtime.mjs";
import { loadTs } from "./mc-test-runtime.mjs";

const { SERVER_JVM_FLAGS, flagSupportReason, formatServerFlag, recommendedJavaForVersion } = loadTs("../src/lib/mc/server-launch.ts");
const versions = ["26.1", "1.21.8", "1.21.5", "1.20.6", "1.20.4", "1.17", "1.16.5", "1.12.2", "1.8.9"];
const counts = { versions: 0, memory: 0, state: 0, parameters: 0, downloads: 0, copy: 0 };
const text = (node) => Array.isArray(node) ? node.map(text).join("") : node?.props ? text(node.props.children) : typeof node === "string" || typeof node === "number" ? String(node) : "";
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const output = (ui) => text(ui.all("pre")[0]);
const field = (ui, label) => ui.nodes().find((node) => node.props["aria-label"] === label);
const collector = (ui, id) => ui.all("input").find((node) => node.props.type === "radio" && node.props.value === id);
const flagCheckbox = (ui, id) => {
  const card = ui.all("article").find((node) => node.props["data-jvm-flag"] === id);
  return nodes(card).find((node) => node.type === "input" && node.props.type === "checkbox");
};
const memoryField = (ui, label) => {
  const component = ui.nodes().find((node) => typeof node.type === "function" && node.type.name === "MemoryField" && node.props.label === label);
  assert.ok(component, label);
  return nodes(component.type(component.props));
};
const memoryInput = (ui, label) => memoryField(ui, label).find((node) => node.type === "input");
const memoryUnit = (ui, label) => memoryField(ui, label).find((node) => node.type === "select");

for (const version of versions) {
  const ui = mount("ServerLaunchTool", { version });
  assert.ok(!ui.button("复制启动命令").props.disabled, version);
  assert.match(output(ui), /-Xms1024m\b.*-Xmx2048m\b/i);
  assert.match(ui.text(), new RegExp(`Java ${recommendedJavaForVersion(version)}`));
  assert.ok(ui.all("input").filter((node) => node.props.type === "radio" && node.props.checked).length === 1);
  counts.versions += 4;

  ui.edit(memoryUnit(ui, "起始内存 · Xms"), "MiB");
  assert.equal(memoryInput(ui, "起始内存 · Xms").props.value, "1024");
  assert.match(output(ui), /-Xms1024m\b/i);
  ui.edit(memoryUnit(ui, "起始内存 · Xms"), "GiB");
  assert.equal(memoryInput(ui, "起始内存 · Xms").props.value, "1");
  ui.edit(memoryInput(ui, "起始内存 · Xms"), "");
  assert.equal(memoryInput(ui, "起始内存 · Xms").props.value, "");
  assert.ok(ui.button("复制启动命令").props.disabled);
  ui.edit(memoryInput(ui, "起始内存 · Xms"), "0.5");
  assert.match(output(ui), /-Xms512m\b/i);
  ui.edit(memoryInput(ui, "最大内存 · Xmx"), "0.25");
  assert.ok(ui.button("复制启动命令").props.disabled);
  counts.memory += 7;
  ui.unmount();
}

{
  const ui = mount("ServerLaunchTool", { version: "1.8.9" });
  assert.match(ui.text(), /Java 8/);
  ui.props({ version: "26.1" });
  assert.match(ui.text(), /Java 25/);
  ui.edit(field(ui, "Java 版本"), "8");
  assert.ok(ui.button("复制启动命令").props.disabled);
  ui.props({ version: "1.8.9" });
  assert.ok(!ui.button("复制启动命令").props.disabled);
  ui.edit(field(ui, "核心 JAR 文件名"), "");
  assert.ok(ui.button("复制启动命令").props.disabled);
  assert.ok(ui.button("下载 start").props.disabled);
  ui.edit(field(ui, "核心 JAR 文件名"), "server.jar");
  ui.edit(field(ui, "Java 执行文件"), "custom");
  assert.ok(ui.button("复制启动命令").props.disabled);
  ui.edit(field(ui, "Java 完整路径"), "C:\\Program Files\\Java\\jdk-8\\bin\\java.exe");
  assert.ok(!ui.button("复制启动命令").props.disabled);
  assert.match(output(ui), /"C:\\Program Files\\Java\\jdk-8\\bin\\java.exe"/);
  ui.edit(field(ui, "Java 完整路径"), "C:\\Java\\java.exe\ncalc");
  assert.ok(ui.button("复制启动命令").props.disabled);
  counts.state += 10;
  ui.unmount();
}

{
  const ui = mount("ServerLaunchTool", { version: "1.21.8" });
  ui.edit(field(ui, "Java 版本"), "21");
  ui.edit(collector(ui, "g1"), true);
  assert.equal(ui.all("input").filter((node) => node.props.type === "radio" && node.props.checked).length, 1);
  const numeric = SERVER_JVM_FLAGS.find((flag) => flag.kind === "number" && !flagSupportReason(flag, 21, "g1"));
  assert.ok(numeric);
  assert.ok(!field(ui, `${numeric.label}参数值`));
  ui.edit(flagCheckbox(ui, numeric.id), true);
  assert.ok(field(ui, `${numeric.label}参数值`));
  ui.edit(field(ui, `${numeric.label}参数值`), "");
  assert.ok(ui.button("复制启动命令").props.disabled);
  ui.edit(field(ui, `${numeric.label}参数值`), String(numeric.defaultValue));
  assert.ok(!ui.button("复制启动命令").props.disabled);
  ui.button("清空参数").props.onClick();
  assert.ok(!field(ui, `${numeric.label}参数值`));
  counts.parameters += 7;

  ui.edit(collector(ui, "zgc"), true);
  const zgc = SERVER_JVM_FLAGS.find((flag) => flag.collector === "zgc" && !flagSupportReason(flag, 21, "zgc"));
  assert.ok(zgc);
  ui.edit(flagCheckbox(ui, zgc.id), true);
  assert.ok(!ui.button("复制启动命令").props.disabled);
  ui.edit(field(ui, "Java 版本"), "8");
  assert.ok(collector(ui, "zgc").props.disabled);
  assert.ok(collector(ui, "zgc").props.checked);
  assert.ok(flagCheckbox(ui, zgc.id).props.disabled);
  assert.ok(flagCheckbox(ui, zgc.id).props.checked);
  assert.ok(ui.button("复制启动命令").props.disabled);
  ui.edit(collector(ui, "default"), true);
  assert.ok(ui.button("复制启动命令").props.disabled);
  ui.button("取消选择").props.onClick();
  ui.props({ version: "1.8.9" });
  assert.ok(!ui.button("复制启动命令").props.disabled);
  counts.parameters += 9;
  ui.unmount();
}

// Exercise every parameter through the component, including dependencies and
// flags with a non-XX syntax or a memory suffix in the rendered card.
for (const flag of SERVER_JVM_FLAGS) {
  const java = flag.javaMax === 8 ? 8 : flag.javaMax === 23 ? 21 : 25;
  const version = java === 8 ? "1.8.9" : java === 21 ? "1.21.8" : "26.1";
  const gc = flag.collector ?? flag.collectors?.[0] ?? "default";
  const ui = mount("ServerLaunchTool", { version });
  ui.edit(field(ui, "Java 版本"), String(java));
  ui.edit(collector(ui, gc), true);
  if (flag.id === "PrintGCDateStamps") ui.edit(flagCheckbox(ui, "PrintGCDetails"), true);
  if (flag.id === "ConcGCThreads" && gc === "g1") ui.edit(flagCheckbox(ui, "ParallelGCThreads"), true);
  const rendered = ui.all("article").find((node) => node.props["data-jvm-flag"] === flag.id);
  const formatted = formatServerFlag(flag, flag.defaultValue, java);
  assert.ok(text(rendered).includes(formatted), `${flag.id} displayed syntax`);
  assert.ok(!flagCheckbox(ui, flag.id).props.checked);
  ui.edit(flagCheckbox(ui, flag.id), true);
  assert.ok(flagCheckbox(ui, flag.id).props.checked);
  assert.equal(!!field(ui, `${flag.label}参数值`), flag.kind === "number");
  assert.ok(!ui.button("复制启动命令").props.disabled, `${flag.id}: ${ui.text()}`);
  assert.ok(output(ui).includes(formatted), `${flag.id} generated syntax`);
  ui.edit(flagCheckbox(ui, flag.id), false);
  assert.ok(!flagCheckbox(ui, flag.id).props.checked);
  assert.ok(!field(ui, `${flag.label}参数值`));
  counts.parameters += 8;
  ui.unmount();
}

const clipboard = [];
{
  const ui = mount("ServerLaunchTool", { version: "26.1" });
  assert.ok(!ui.button("复制启动命令").props.disabled);
  // HTML number inputs expose unfinished "1e" as value="", badInput=true.
  // An optional physical-RAM field must not turn this into an omitted value.
  memoryInput(ui, "机器总内存").props.onChange({ target: { value: "", validity: { badInput: true } } });
  assert.equal(memoryInput(ui, "机器总内存").props.value, "");
  assert.equal(memoryInput(ui, "机器总内存").props["aria-invalid"], true);
  assert.ok(ui.button("复制启动命令").props.disabled);
  ui.edit(memoryUnit(ui, "机器总内存"), "MiB");
  assert.ok(ui.button("复制启动命令").props.disabled, "Changing units must not erase badInput");
  // Clearing "1e" can keep DOM.value equal to "", so React's value tracker
  // need not dispatch onChange. The native input event must still clear it.
  memoryInput(ui, "机器总内存").props.onInput({ currentTarget: { value: "", validity: { badInput: false } } });
  assert.ok(!ui.button("复制启动命令").props.disabled, "A truly empty optional value is valid");
  assert.equal(memoryInput(ui, "机器总内存").props["aria-invalid"], false);
  memoryInput(ui, "机器总内存").props.onInput({ currentTarget: { value: "", validity: { badInput: true } } });
  assert.ok(ui.button("复制启动命令").props.disabled, "Native input must also capture an unchanged empty bad value");
  memoryInput(ui, "机器总内存").props.onInput({ currentTarget: { value: "16", validity: { badInput: false } } });
  assert.ok(!ui.button("复制启动命令").props.disabled, "Completing the number restores the output");
  assert.equal(memoryInput(ui, "机器总内存").props.value, "16");
  counts.memory += 10;
  ui.unmount();
}

Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: (value) => new Promise((resolve, reject) => clipboard.push({ value, resolve, reject })) } } });
{
  const ui = mount("ServerLaunchTool", { version: "26.1" });
  ui.button("复制启动命令").props.onClick();
  assert.equal(clipboard.at(-1).value, output(ui));
  clipboard.at(-1).reject(new Error("denied"));
  await flush();
  assert.match(ui.text(), /复制失败/);
  ui.edit(field(ui, "核心 JAR 文件名"), "paper.jar");
  assert.doesNotMatch(ui.text(), /复制失败/);
  ui.button("复制启动命令").props.onClick();
  const previous = clipboard.at(-1);
  ui.edit(field(ui, "核心 JAR 文件名"), "purpur.jar");
  ui.button("复制启动命令").props.onClick();
  clipboard.at(-1).resolve();
  await flush();
  previous.reject(new Error("old request"));
  await flush();
  assert.match(ui.text(), /已复制/);
  assert.doesNotMatch(ui.text(), /复制失败/);
  counts.copy += 5;
  ui.unmount();
}

const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
const created = [], revoked = [], links = [];
URL.createObjectURL = (blob) => { const url = `blob:launch-${created.length}`; created.push({ url, blob }); return url; };
URL.revokeObjectURL = (url) => revoked.push(url);
globalThis.document = {
  body: { append(link) { link.appended = true; } },
  createElement() { const link = { click() { this.clicked = true; }, remove() { this.removed = true; } }; links.push(link); return link; },
};
try {
  for (const platform of ["cmd", "powershell", "sh"]) {
    const ui = mount("ServerLaunchTool", { version: "26.1" });
    ui.edit(field(ui, "命令环境"), platform);
    ui.button("下载 start").props.onClick();
    const downloaded = created.at(-1), link = links.at(-1);
    assert.ok(link.appended && link.clicked && link.removed);
    assert.equal(link.download, platform === "cmd" ? "start.bat" : platform === "powershell" ? "start.ps1" : "start.sh");
    const bytes = new Uint8Array(await downloaded.blob.arrayBuffer());
    if (platform === "powershell") assert.deepEqual([...bytes.slice(0, 3)], [239, 187, 191]);
    else if (platform === "sh") assert.deepEqual([...bytes.slice(0, 2)], [35, 33]);
    else assert.notDeepEqual([...bytes.slice(0, 3)], [239, 187, 191]);
    assert.match(ui.text(), /脚本已准备下载/);
    ui.edit(field(ui, "核心 JAR 文件名"), "paper.jar");
    assert.doesNotMatch(ui.text(), /脚本已准备下载/);
    ui.tick(60_000);
    assert.ok(revoked.includes(downloaded.url));
    ui.unmount();
    counts.downloads += 6;
  }
  {
    const ui = mount("ServerLaunchTool", { version: "26.1" });
    ui.button("下载 start").props.onClick();
    const downloaded = created.at(-1);
    ui.unmount();
    assert.ok(revoked.includes(downloaded.url));
    counts.downloads++;
  }
  {
    const ui = mount("ServerLaunchTool", { version: "26.1" });
    const oldAppend = document.body.append;
    document.body.append = () => { throw new Error("blocked"); };
    ui.button("下载 start").props.onClick();
    assert.match(ui.text(), /下载失败/);
    assert.ok(revoked.includes(created.at(-1).url));
    assert.ok(links.at(-1).removed);
    document.body.append = oldAppend;
    ui.edit(field(ui, "核心 JAR 文件名"), "paper.jar");
    assert.doesNotMatch(ui.text(), /下载失败/);
    counts.downloads += 4;
    ui.unmount();
  }
} finally {
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
}

console.log("Server launch UI verified:", JSON.stringify(counts), "total", Object.values(counts).reduce((sum, value) => sum + value, 0));
