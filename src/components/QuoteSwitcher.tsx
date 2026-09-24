"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { quotes } from "@/data/quotes";

export default function QuoteSwitcher() {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  function nextQuote() {
    setIndex((current) => {
      const offset = 1 + Math.floor(Math.random() * (quotes.length - 1));
      return (current + offset) % quotes.length;
    });
  }

  return (
    <section className="quote-section section-wrap" aria-label="随机一句">
      <div className="quote-topline"><span className="eyebrow">A THOUGHT TO KEEP</span><span className="quote-counter">{String(index + 1).padStart(2, "0")} <i>/</i> {String(quotes.length).padStart(2, "0")}</span></div>
      <button className="quote-stage" onClick={nextQuote} aria-label="换一句话">
        <span className="quote-mark" aria-hidden="true">“</span>
        <span className="quote-copy" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span className="quote-lines" key={index} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -10 }} transition={{ duration: reduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}>
              <span className="quote-english" lang="en">{quotes[index].en}</span>
              <span className="quote-translation" lang="zh-CN">{quotes[index].zh}</span>
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="quote-next">点一下，换个念头 <span>↗</span></span>
      </button>
      <div className="quote-bottomline"><span>随机一句</span><span className="quote-line" /><span>TAKE A BREATH</span></div>
    </section>
  );
}
