"use client";

import { useMemo, useSyncExternalStore } from "react";
import { quotes } from "@/data/quotes";

const STORAGE_KEY = "pkqa-favorite-quotes-v1";
const CHANGE_EVENT = "pkqa-favorites-change";
const EMPTY = "[]";
const knownQuotes = new Set<string>(quotes.map((quote) => quote.en));
let temporarySnapshot: string | null = null;

function getSnapshot() {
  if (temporarySnapshot !== null) return temporarySnapshot;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function parseSnapshot(snapshot: string): string[] {
  try {
    const value: unknown = JSON.parse(snapshot);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((key): key is string =>
      typeof key === "string" && knownQuotes.has(key),
    ))];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      temporarySnapshot = null;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function toggleFavorite(key: string) {
  if (!knownQuotes.has(key)) return false;
  const current = parseSnapshot(getSnapshot());
  const next = current.includes(key)
    ? current.filter((item) => item !== key)
    : [...current, key];
  const snapshot = JSON.stringify(next);
  let persisted = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, snapshot);
    temporarySnapshot = null;
  } catch {
    // Keep the interaction usable when storage is blocked or full.
    temporarySnapshot = snapshot;
    persisted = false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return persisted;
}

export default function useQuoteFavorites() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const favorites = useMemo(() => parseSnapshot(snapshot), [snapshot]);
  return { favorites, toggleFavorite };
}
