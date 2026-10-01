import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const source = "https://webisso.github.io/minecraft-item-icons";
const response = await fetch(`${source}/api.json`);
if (!response.ok) throw new Error(`Icon catalog returned ${response.status}`);
const groups = await response.json();
const files = groups.flatMap((group) => group.files ?? []);
const ids = [
  "decorated_pot", "chest", "ender_chest", "shulker_box", "conduit", "trapped_chest", "shield",
  ...["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"].map((color) => `${color}_banner`),
];
const icons = {};
for (const id of ids) {
  const slug = `${id.replaceAll("_", "-")}.png`;
  const file = files.find((entry) => entry.file_slug === slug && entry.category_slug !== "75-gui");
  if (!file) throw new Error(`Fallback icon missing: ${id}`);
  icons[id] = `${source}/assets/${file.category_slug}/${file.subcategory_slug}/${file.file_slug}`;
}
await writeFile(join(process.cwd(), "scripts", "mc-fallback-icons.json"), JSON.stringify(icons, null, 2) + "\n");
console.log(`Indexed ${ids.length} fallback icons`);
