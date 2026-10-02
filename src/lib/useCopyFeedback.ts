"use client";

import { useEffect, useRef, useState } from "react";

// Feedback belongs to the exact copied text, even if a permission prompt delays
// clipboard completion while the user edits a command or starts another copy.
export default function useCopyFeedback() {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const sequence = useRef(0);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    sequence.current++;
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  async function copy(value: string): Promise<boolean | null> {
    if (!value) return false;
    const request = ++sequence.current;
    if (timer.current !== null) window.clearTimeout(timer.current);
    setCopiedValue(null);
    try {
      await navigator.clipboard.writeText(value);
      if (request !== sequence.current) return null;
      setCopiedValue(value);
      timer.current = window.setTimeout(() => {
        if (request === sequence.current) {
          setCopiedValue(null);
          timer.current = null;
        }
      }, 1600);
      return true;
    } catch {
      if (request !== sequence.current) return null;
      setCopiedValue(null);
      return false;
    }
  }

  return { copy, isCopied: (value: string) => !!value && value === copiedValue };
}
