import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { loadTs } from "./mc-test-runtime.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/components/tools/PlayerLookup.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;

// Run the real component with controlled hooks, requests and timers. Requests can
// deliberately ignore cancellation to reproduce an out-of-order network response.
function mount() {
  const hooks = [], effects = [], requests = [], timers = new Map();
  let cursor = 0, timerId = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial; return [hooks[index], (value) => { hooks[index] = value; }]; },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useCallback(callback) { cursor++; return callback; },
    useEffect(effect) { const index = cursor++; if (!(index in hooks)) { hooks[index] = true; effects.push(effect); } },
  };
  const window = {
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  function fetch(url, { signal }) {
    return new Promise((resolve, reject) => { requests.push({ url, signal, resolve, reject }); });
  }
  const exports = {};
  new Function("exports", "require", "window", "fetch", code)(exports, (name) => {
    if (name === "react") return react;
    if (name === "@/lib/useCopyFeedback") return loadTs("../src/lib/useCopyFeedback.ts", { react });
    if (name === "@/components/tools/CapePreview") return { default: () => null };
    return require(name);
  }, window, fetch);
  function render() { cursor = 0; return exports.default(); }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== "object" || !node.props) return [];
    return [node, ...nodes(node.props.children)];
  }
  function text(node) {
    if (Array.isArray(node)) return node.map((child) => text(child)).join("");
    if (node?.props) return text(node.props.children);
    return typeof node === "string" || typeof node === "number" ? String(node) : "";
  }
  const find = (type) => nodes(render()).find((node) => node.type === type);
  const edit = (value) => find("input").props.onChange({ target: { value } });
  const submit = () => find("form").props.onSubmit({ preventDefault() {} });
  function tick(delay) { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.callback(); } }
  render();
  const cleanup = effects.map((effect) => effect());
  return { requests, text: () => text(render()), find, edit, submit, tick, unmount: () => cleanup.forEach((fn) => fn?.()) };
}

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function respond(request, username, status = 200) {
  request.resolve({ ok: status === 200, status, json: async () => ({ data: { player: { username, id: `uuid-${username}` } } }) });
}

const ui = mount();
ui.tick(0);
assert.match(ui.requests[0].url, /\/Pkqa$/);
assert.match(ui.text(), /正在查找 Pkqa 的玩家档案/);
assert.equal(ui.find("button").props.disabled, true);

ui.edit("pkqa_");
assert.equal(ui.requests[0].signal.aborted, true);
assert.equal(ui.find("button").props.disabled, false);
assert.doesNotMatch(ui.text(), /正在查找 Pkqa/);
ui.submit();
assert.match(ui.requests[1].url, /\/pkqa_$/);
assert.match(ui.text(), /正在查找 pkqa_ 的玩家档案/);
respond(ui.requests[0], "Pkqa");
await flush();
assert.match(ui.text(), /正在查找 pkqa_ 的玩家档案/);
assert.doesNotMatch(ui.text(), /uuid-Pkqa/);
respond(ui.requests[1], "pkqa_");
await flush();
assert.match(ui.text(), /uuid-pkqa_/);
assert.equal(ui.find("button").props.disabled, false);

ui.edit("  Notch  "); ui.submit();
assert.match(ui.requests[2].url, /\/Notch$/);
assert.match(ui.text(), /正在查找 Notch 的玩家档案/);
ui.edit("a"); ui.submit();
ui.requests[2].reject(new DOMException("Aborted", "AbortError"));
await flush();
assert.match(ui.text(), /请输入 3–16 位/);
assert.doesNotMatch(ui.text(), /查询超时/);
assert.equal(ui.requests.length, 3);

ui.edit("NoSuchPlayer"); ui.submit(); respond(ui.requests[3], "", 404); await flush();
assert.match(ui.text(), /玩家不存在/);
ui.edit("Notch"); ui.submit(); respond(ui.requests[4], "", 429); await flush();
assert.match(ui.text(), /查询太频繁/);
ui.submit(); ui.requests[5].reject(new Error("Network unavailable")); await flush();
assert.match(ui.text(), /Network unavailable/);
assert.equal(ui.find("button").props.disabled, false);

ui.submit();
ui.requests[6].signal.addEventListener("abort", () => ui.requests[6].reject(new DOMException("Aborted", "AbortError")));
ui.tick(10000); await flush();
assert.match(ui.text(), /查询超时/);
assert.equal(ui.find("button").props.disabled, false);

ui.edit("d5ebe79d-588c-4cba-b338-f5f27109ec83"); ui.submit();
assert.match(ui.text(), /正在查找 d5ebe79d-588c-4cba-b338-f5f27109ec83/);
ui.unmount();
assert.equal(ui.requests[7].signal.aborted, true);
respond(ui.requests[7], "OldResponse"); await flush();
assert.doesNotMatch(ui.text(), /uuid-OldResponse/);

console.log("Player lookup passed: default lookup, edited names, replacement requests, stale responses, validation, HTTP errors, network failure, timeout and unmount.");
