"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export default function SecretDot() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [open]);

  function discover() {
    if (timer.current !== null) clearTimeout(timer.current);
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    timer.current = setTimeout(() => setOpen(false), 5000);
  }

  return (
    <span className="secret-dot-wrap">
      <button className="title-period secret-dot" type="button" onClick={discover}
        aria-label="发现一个小彩蛋" aria-pressed={open} title="这里藏着一点小东西">
        .
      </button>
      <AnimatePresence>
        {open && (
          <motion.span className="secret-note" aria-hidden="true"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -5 }}
            transition={{ duration: reduceMotion ? 0 : 0.3 }}>
            <svg className="secret-flower" viewBox="0 0 32 40" shapeRendering="crispEdges">
              <path fill="#79a992" d="M14 20h4v18h-4zM6 26h8v4H6zM18 30h8v4h-8z" />
              <path fill="#b9c3e8" d="M10 2h12v6H10zM4 8h6v12H4zM22 8h6v12h-6zM10 20h12v6H10z" />
              <path fill="#dfc98d" d="M10 8h12v12H10z" />
            </svg>
            <span><strong>你发现了一点小幸运。</strong><span>今天也留点时间，做喜欢的事。</span></span>
          </motion.span>
        )}
      </AnimatePresence>
      <span className="interaction-sr-only" role="status">
        {open ? "你发现了一点小幸运。今天也留点时间，做喜欢的事。" : ""}
      </span>
    </span>
  );
}
