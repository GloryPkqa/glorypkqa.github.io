import { versionAtLeast, type McCatalog } from "@/lib/mc/give";

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string";
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(string);
const entries = (value: unknown, test: (entry: Record<string, unknown>) => boolean) => Array.isArray(value) && value.every((entry) => object(entry) && test(entry));
const id = (value: unknown): value is string => string(value) && /^[a-z0-9_]+$/.test(value);
// Legacy entity IDs are case-sensitive names such as PigZombie (Java 1.8).
const named = (entry: Record<string, unknown>) => string(entry.name) && /^[A-Za-z0-9_]+$/.test(entry.name) && string(entry.displayName) && entry.displayName.length > 0;
const positiveInteger = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value > 0;
const uniqueNames = (value: unknown) => Array.isArray(value) && value.length > 0 && new Set(value.map((entry) => entry.name)).size === value.length;
const ingredient = (value: unknown) => value === null || string(value) || strings(value);

// Validate the static JSON before any child tool reads it. A failed/old asset
// should show a retry action instead of crashing the whole workbench.
export function isMcCatalog(value: unknown, version: string): value is McCatalog {
  if (!object(value) || value.version !== version || !string(value.sourceVersion) || !value.sourceVersion) return false;
  if (!entries(value.items, (entry) => named(entry) && string(entry.displayNameZh) && string(entry.category) && positiveInteger(entry.stackSize) && typeof entry.icon === "boolean" && (entry.iconUrl === null || string(entry.iconUrl)))) return false;
  if (!entries(value.enchantments, (entry) => named(entry) && string(entry.displayNameZh) && positiveInteger(entry.maxLevel) && strings(entry.exclude) && string(entry.category))) return false;
  if (!entries(value.effects, (entry) => named(entry) && string(entry.displayNameZh) && typeof entry.id === "number" && Number.isInteger(entry.id) && entry.id >= 0 && string(entry.type))) return false;
  if (!entries(value.blocks, named) || !entries(value.entities, (entry) => named(entry) && string(entry.displayNameZh) && string(entry.type))) return false;
  if (![value.items, value.enchantments, value.effects, value.blocks, value.entities].every(uniqueNames)) return false;
  if (!object(value.recipes) || !Object.entries(value.recipes).every(([result, variants]) => id(result) && Array.isArray(variants) && variants.length > 0 && entries(variants, (entry) => positiveInteger(entry.count) && (Array.isArray(entry.shape)
    ? entry.shape.length > 0 && entry.shape.length <= 3 && entry.shape.every((row) => Array.isArray(row) && row.length > 0 && row.length <= 3 && row.every((entryId) => entryId === null || id(entryId)))
      && entry.shape.some((row) => Array.isArray(row) && row.some((entryId) => entryId !== null))
    : strings(entry.ingredients) && entry.ingredients.length > 0 && entry.ingredients.length <= 9 && entry.ingredients.every(id))))) return false;
  if (versionAtLeast(version, "1.16") && (Object.keys(value.recipes).length === 0 || !Array.isArray(value.processingRecipes) || value.processingRecipes.length === 0)) return false;
  return entries(value.processingRecipes, (entry) => string(entry.id) && ["smelting", "blasting", "smoking", "campfire_cooking", "stonecutting", "smithing_transform", "smithing_trim"].includes(String(entry.type))
    && positiveInteger(entry.count) && (entry.result === null || string(entry.result))
    && [entry.ingredient, entry.template, entry.base, entry.addition].every(ingredient)
    && (entry.ticks === null || typeof entry.ticks === "number" && Number.isFinite(entry.ticks) && entry.ticks >= 0)
    && (entry.xp === null || typeof entry.xp === "number" && Number.isFinite(entry.xp) && entry.xp >= 0));
}
