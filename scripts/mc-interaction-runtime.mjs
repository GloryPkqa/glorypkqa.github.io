import assert from "node:assert/strict";
import { loadTs } from "./mc-test-runtime.mjs";

// Controlled hook lifecycle for component fixtures. Dependency changes run
// cleanup and effects; browser checks separately cover real React/DOM behavior.
export function mount(path, initialProps = {}, options = {}) {
  const hooks = [], requests = [], timers = new Map(), pendingEffects = new Map();
  let cursor = 0, timerId = 0, props = initialProps, dirty = false;
  const same = (a, b) => a !== undefined && b !== undefined && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = { value: typeof initial === "function" ? initial() : initial };
      return [hooks[i].value, (next) => { const value = typeof next === "function" ? next(hooks[i].value) : next; if (!Object.is(value, hooks[i].value)) { hooks[i].value = value; dirty = true; } }];
    },
    useRef(initial) { const i = cursor++; return hooks[i] ??= { current: initial }; },
    useMemo(callback, deps) { const i = cursor++; if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = { value: callback(), deps }; return hooks[i].value; },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) { const i = cursor++; if (!hooks[i] || !same(hooks[i].deps, deps)) { const cleanup = hooks[i]?.cleanup; hooks[i] = { deps, cleanup }; pendingEffects.set(i, effect); } },
  };
  globalThis.window = { setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearTimeout(id) { timers.delete(id); } };
  options.setupWindow?.(globalThis.window);
  globalThis.fetch = (url, { signal } = {}) => new Promise((resolve, reject) => requests.push({ url, signal, resolve, reject }));
  const imports = { react, "@/components/tools/TextStyleControls": { default: () => null }, "@/components/tools/RecipeTool": { ItemIcon: () => null, default: () => null }, "@/components/tools/CapePreview": { default: () => null } };
  if (path === "McWorkbench") {
    imports["next/link"] = { default: () => null };
    imports["@/components/ThemeToggle"] = { default: () => null };
    for (const name of ["ColorTool", "CoordinateTool", "ServerLookup", "PlayerLookup", "VersionFeed", "EffectTool", "TitleTool", "BlockTool", "WorldTool", "SummonTool", "BannerTool", "ProcessingRecipeTool", "DataPackTool", "ServerLaunchTool", "ServerSizingTool"]) imports[`@/components/tools/${name}`] = { default: () => null };
  }
  const component = loadTs(`../src/components/tools/${path}.tsx`, { ...imports, ...options.imports })[options.exportName ?? "default"];
  function render() {
    let tree, count = 0;
    do {
      assert.ok(count++ < 20, "Component did not settle"); dirty = false; cursor = 0; tree = component(props);
      for (const [i, effect] of [...pendingEffects]) { pendingEffects.delete(i); hooks[i].cleanup?.(); hooks[i].cleanup = effect(); }
    } while (dirty);
    return tree;
  }
  function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); return node?.props ? [node, ...nodes(node.props.children)] : []; }
  function content(node) { if (Array.isArray(node)) return node.map(content).join(""); return node?.props ? content(node.props.children) : typeof node === "string" || typeof node === "number" ? String(node) : ""; }
  const all = (type) => nodes(render()).filter((node) => node.type === type);
  const button = (name) => all("button").find((node) => content(node).includes(name));
  const edit = (node, value) => { assert.ok(node?.props.onChange); node.props.onChange({ target: { value, checked: value } }); };
  const commands = () => all("code").map(content).filter((text) => /^\/[a-z]/.test(text));
  const tick = (delay) => { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.callback(); } render(); };
  render();
  return { all, nodes: () => nodes(render()), text: () => content(render()), button, edit, commands, requests, timers, tick, submit: () => all("form")[0].props.onSubmit({ preventDefault() {} }), props: (value) => { props = value; render(); }, unmount: () => hooks.forEach((hook) => hook?.cleanup?.()) };
}
export const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
export const respond = (request, data, status = 200) => request.resolve({ ok: status === 200, status, json: async () => data });
