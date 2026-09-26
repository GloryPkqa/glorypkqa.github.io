"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
import { quotes } from "@/data/quotes";
import useQuoteFavorites from "@/lib/useQuoteFavorites";

function Bookmark({ filled = false }: { filled?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"}><path d="M6 4h12v17l-6-4-6 4V4Z" /></svg>;
}

export default function QuoteSwitcher() {
  const [index, setIndex] = useState(0);
  const [isChanging, setIsChanging] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const quoteButton = useRef<HTMLButtonElement>(null);
  const favoritesButton = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const { favorites, toggleFavorite } = useQuoteFavorites();
  const isFavorite = favorites.includes(quotes[index].en);
  const savedQuotes = favorites.flatMap((key) => {
    const savedIndex = quotes.findIndex((quote) => quote.en === key);
    return savedIndex < 0 ? [] : [{ ...quotes[savedIndex], index: savedIndex }];
  });

  function changeQuote(nextIndex: number) {
    if (isChanging || nextIndex === index) return;
    setIsChanging(!reduceMotion);
    setIndex(nextIndex);
  }

  function nextQuote() {
    if (quotes.length < 2) return;
    const offset = 1 + Math.floor(Math.random() * (quotes.length - 1));
    changeQuote((index + offset) % quotes.length);
  }

  function saveQuote(key: string) {
    const removing = favorites.includes(key);
    const persisted = toggleFavorite(key);
    setStorageWarning(!persisted);
    setAnnouncement(removing ? "已取消收藏。" : "已收藏这句话。");
  }

  function readFavorite(savedIndex: number) {
    changeQuote(savedIndex);
    quoteButton.current?.focus({ preventScroll: true });
    quoteButton.current?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "center" });
  }

  return (
    <section className="quote-section section-wrap" id="thoughts" aria-label="随机一句">
      <div className="quote-topline"><span className="eyebrow">A THOUGHT TO KEEP</span><span className="quote-counter">{String(index + 1).padStart(2, "0")} <i>/</i> {String(quotes.length).padStart(2, "0")}</span></div>
      <button ref={quoteButton} className="quote-stage" type="button" onClick={nextQuote} aria-label="换一句话" disabled={isChanging} aria-busy={isChanging}>
        <span className="quote-mark" aria-hidden="true">“</span>
        <span className="quote-copy" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span className="quote-lines" key={index}
              variants={{ hidden: { opacity: 0, y: reduceMotion ? 0 : 12 }, shown: { opacity: 1, y: 0 }, leaving: { opacity: 0, y: reduceMotion ? 0 : -10 } }}
              initial={reduceMotion ? false : "hidden"} animate="shown" exit="leaving"
              onAnimationComplete={(definition) => { if (definition === "shown") setIsChanging(false); }}
              transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}>
              <span className="quote-english" lang="en">{quotes[index].en}</span>
              <span className="quote-translation" lang="zh-CN">{quotes[index].zh}</span>
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="quote-next">点一下，换个念头 <span>↗</span></span>
      </button>
      <div className="quote-tools">
        <button className="quote-tool" type="button" aria-pressed={isFavorite} disabled={isChanging} onClick={() => saveQuote(quotes[index].en)}>
          <Bookmark filled={isFavorite} /><span>{isFavorite ? "已收藏" : "收藏这句"}</span>
        </button>
        <button ref={favoritesButton} className="quote-tool favorites-toggle" type="button"
          aria-expanded={showFavorites} aria-controls="saved-thoughts" onClick={() => setShowFavorites(!showFavorites)}>
          我的收藏 <span className="favorites-count">{favorites.length}</span><span className="favorites-chevron" aria-hidden="true">⌄</span>
        </button>
      </div>
      <span className="interaction-sr-only" role="status">{announcement}</span>
      {storageWarning && <p className="favorites-storage-note" role="status">浏览器暂时无法保存，收藏仅在本次打开期间保留。</p>}
      <AnimatePresence initial={false}>
        {showFavorites && (
          <motion.div id="saved-thoughts" className="favorites-panel" role="region" aria-labelledby="saved-thoughts-title"
            initial={{ height: reduceMotion ? "auto" : 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: reduceMotion ? "auto" : 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3 }}>
            <div className="favorites-inner">
              <div className="favorites-heading"><h3 id="saved-thoughts-title">留住的念头</h3><p>仅保存在当前浏览器</p></div>
              {savedQuotes.length === 0 ? (
                <p className="favorites-empty">还没有收藏。遇到喜欢的句子，就把它留在这里吧。</p>
              ) : (
                <ul className="favorites-list">
                  {savedQuotes.map((quote) => (
                    <li key={quote.en}>
                      <button className="favorite-read" type="button" disabled={isChanging} onClick={() => readFavorite(quote.index)} aria-label={"重读：" + quote.en}>
                        <span lang="en">{quote.en}</span><small lang="zh-CN">{quote.zh}</small>
                      </button>
                      <button className="favorite-remove" type="button" aria-label={"取消收藏：" + quote.en} title="取消收藏" onClick={() => {
                        saveQuote(quote.en);
                        favoritesButton.current?.focus({ preventScroll: true });
                      }}><Bookmark filled /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
