import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const response = await fetch("https://blockrender.dev/api/items", { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Block Render catalog returned ${response.status}`);
const catalog = await response.json();
if (!Array.isArray(catalog.items) || !catalog.version) throw new Error("Unexpected item catalog format");
const items = Object.fromEntries(catalog.items
  .filter((item) => /^[a-z0-9_]+$/.test(item.id))
  .map((item) => [item.id, { category: item.category, renderable: item.renderable === true }]));
await writeFile(join(process.cwd(), "scripts", "mc-item-categories.json"), JSON.stringify({ sourceVersion: catalog.version, items }));
console.log(`Saved ${Object.keys(items).length} item categories from Block Render ${catalog.version}`);
