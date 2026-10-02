import type { McCatalog } from "@/lib/mc/give";

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string";
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(string);
const entries = (value: unknown, test: (entry: Record<string, unknown>) => boolean) => Array.isArray(value) && value.every((entry) => object(entry) && test(entry));
const named = (entry: Record<string, unknown>) => string(entry.name) && string(entry.displayName);
const ingredient = (value: unknown) => value === null || string(value) || strings(value);

// Validate the static JSON before any child tool reads it. A failed/old asset
// should show a retry action instead of crashing the whole workbench.
export function isMcCatalog(value: unknown, version: string): value is McCatalog {
  if (!object(value) || value.version !== version || !string(value.sourceVersion)) return false;
  if (!entries(value.items, (entry) => named(entry) && string(entry.displayNameZh) && string(entry.category) && Number.isInteger(entry.stackSize) && typeof entry.icon === "boolean" && (entry.iconUrl === null || string(entry.iconUrl)))) return false;
  if (!entries(value.enchantments, (entry) => named(entry) && string(entry.displayNameZh) && Number.isInteger(entry.maxLevel) && strings(entry.exclude) && string(entry.category))) return false;
  if (!entries(value.effects, (entry) => named(entry) && string(entry.displayNameZh) && Number.isInteger(entry.id) && string(entry.type))) return false;
  if (!entries(value.blocks, named) || !entries(value.entities, (entry) => named(entry) && string(entry.displayNameZh) && string(entry.type))) return false;
  if (!object(value.recipes) || !Object.values(value.recipes).every((variants) => entries(variants, (entry) => Number.isInteger(entry.count) && (Array.isArray(entry.shape)
    ? entry.shape.length > 0 && entry.shape.length <= 3 && entry.shape.every((row) => Array.isArray(row) && row.length > 0 && row.length <= 3 && row.every((id) => id === null || string(id)))
    : strings(entry.ingredients))))) return false;
  return entries(value.processingRecipes, (entry) => string(entry.id) && ["smelting", "blasting", "smoking", "campfire_cooking", "stonecutting", "smithing_transform", "smithing_trim"].includes(String(entry.type))
    && Number.isInteger(entry.count) && (entry.result === null || string(entry.result))
    && [entry.ingredient, entry.template, entry.base, entry.addition].every(ingredient)
    && (entry.ticks === null || typeof entry.ticks === "number") && (entry.xp === null || typeof entry.xp === "number"));
}
