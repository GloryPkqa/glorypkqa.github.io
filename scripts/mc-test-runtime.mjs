import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const cache = new Map();
export function loadTs(relative, imports = {}) {
  const url = new URL(relative, import.meta.url);
  if (!Object.keys(imports).length && cache.has(url.href)) return cache.get(url.href);
  const source = readFileSync(url, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function("exports", "require", code)(exports, (name) => imports[name] ?? (name.startsWith("@/") ? loadTs(`../src/${name.slice(2)}.ts`) : require(name)));
  if (!Object.keys(imports).length) cache.set(url.href, exports);
  return exports;
}
