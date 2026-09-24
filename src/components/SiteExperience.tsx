"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll } from "framer-motion";
import { useEffect, useState, type MouseEvent } from "react";
import { interests } from "@/data/interests";
import { socials } from "@/data/socials";
import LiveClock from "@/components/LiveClock";
import QuoteSwitcher from "@/components/QuoteSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

const rise = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
} as const;

export default function SiteExperience() {
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const reveal = reduceMotion ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } } : rise;

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  function moveSpotlight(event: MouseEvent<HTMLElement>) {
    if (window.matchMedia("(pointer: fine)").matches) {
      const root = document.documentElement;
      root.style.setProperty("--pointer-x", `${event.clientX}px`);
      root.style.setProperty("--pointer-y", `${event.clientY}px`);
    }
  }

  return (
    <main onMouseMove={moveSpotlight}>
      <div className="ambient-glow ambient-one" aria-hidden="true" />
      <div className="ambient-glow ambient-two" aria-hidden="true" />

      <header className={scrolled ? "site-header is-scrolled" : "site-header"}>
        <a className="wordmark" href="#home" aria-label="Pkqa Center 首页"><span className="mark"><Image src="/avatar.jpg" alt="" width={38} height={38} /></span><span>Pkqa<span className="wordmark-light"> Center.</span></span></a>
        <nav className="desktop-nav" aria-label="主导航">
          <a href="#home">首页</a><a href="#about">关于</a><a href="#interests">兴趣</a><a href="#links">链接</a>
        </nav>
        <div className="header-actions"><span className="header-status"><span className="status-dot" /> MY LITTLE SPACE</span><ThemeToggle /></div>
        <motion.span className="scroll-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />
      </header>
      <nav className="mobile-nav" aria-label="手机导航"><a href="#home">首页</a><a href="#about">关于</a><a href="#interests">兴趣</a><a href="#links">链接</a></nav>

      <section className="hero section-wrap" id="home">
        <span className="hero-watermark" aria-hidden="true">PKQA</span>
        <motion.div className="hero-content" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.12, delayChildren: reduceMotion ? 0 : 0.12 } } }}>
          <motion.div className="hero-kicker" variants={reveal}><span className="kicker-line" /> WELCOME TO MY INTERNET HOME</motion.div>
          <motion.h1 variants={reveal}>Pkqa<span>Center<i className="title-period">.</i></span></motion.h1>
          <motion.p className="hero-subtitle" variants={reveal}>欢迎来到我的一小块互联网空间。</motion.p>
          <motion.p className="hero-description" variants={reveal}>玩游戏、听音乐，也偶尔折腾点有意思的东西。</motion.p>
          <motion.div className="hero-actions" variants={reveal}>
            <a className="primary-link" href="#about">随便逛逛 <span aria-hidden="true">↘</span></a>
            <span className="hero-handle">PERSONAL SPACE <b>·</b> BY GLORYPKQA</span>
          </motion.div>
        </motion.div>
        <motion.div className="hero-visual" initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: reduceMotion ? 0 : 0.5, duration: reduceMotion ? 0 : 0.9 }} aria-label="GloryPkqa 的头像">
          <div className="visual-orbit" aria-hidden="true" />
          <div className="visual-orbit visual-orbit-inner" aria-hidden="true" />
          <div className="portrait-frame"><Image src="/avatar.jpg" alt="GloryPkqa 的卡通头像" width={360} height={360} /></div>
          <span className="visual-spark visual-spark-one" aria-hidden="true">✳</span>
          <span className="visual-spark visual-spark-two" aria-hidden="true">✦</span>
          <span className="visual-note visual-note-top">GAMES · MUSIC · CODE</span>
          <span className="visual-note visual-note-bottom">a little space on the web ↗</span>
        </motion.div>
        <div className="hero-bottom"><span>SCROLL TO EXPLORE</span><span className="scroll-stem" /><LiveClock /></div>
      </section>

      <QuoteSwitcher />

      <section className="about-section section-wrap section-divider" id="about">
        <motion.div className="section-heading" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }}>
          <span className="eyebrow">A LITTLE INTRODUCTION</span><h2>关于<span>我</span></h2>
        </motion.div>
        <motion.div className="about-copy" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }}>
          <p className="about-lead">你好，这里是 <span>GloryPkqa</span>。</p>
          <p>是一名正在学习计算机网络技术的大学生。</p>
          <p>平时喜欢玩 Minecraft 和王者荣耀，<br className="desktop-break" />也喜欢戴着耳机，在网易云里随便听点歌。</p>
          <p>偶尔研究研究代码，偶尔折腾一些自己感兴趣的东西。<br className="desktop-break" />这里没有特别明确的主题，只是想留下一块<br className="desktop-break" />属于自己的互联网角落。</p>
          <div className="about-signoff"><span className="signoff-rule" /> NICE TO MEET YOU <span>☺</span></div>
        </motion.div>
      </section>

      <section className="interests-section section-wrap section-divider" id="interests">
        <motion.div className="section-heading interests-heading" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }}>
          <span className="eyebrow">THINGS I LIKE LATELY</span><h2>最近喜欢的<span>东西</span></h2>
        </motion.div>
        <div className="interest-grid">
          {interests.map((interest, index) => (
            <motion.article className={`interest-card tone-${interest.tone}`} key={interest.name} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} transition={{ delay: reduceMotion ? 0 : index * 0.08 }} whileHover={reduceMotion ? undefined : { y: -4, transition: { duration: 0.22 } }}>
              <div className="interest-card-top"><span className="interest-symbol" aria-hidden="true">{interest.symbol}</span><span className="interest-shine" aria-hidden="true" /></div>
              <div className="interest-card-copy"><span className="interest-english">{interest.english}</span><h3>{interest.name}</h3><p>{interest.description}</p></div>
              <span className="interest-card-mark" aria-hidden="true">↗</span>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="links-section section-wrap section-divider" id="links">
        <motion.div className="links-intro" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }}>
          <div className="section-heading"><span className="eyebrow">ELSEWHERE ON THE INTERNET</span><h2>找到<span>我</span></h2></div>
          <p>如果你也在这些地方，<br />不妨来打个招呼。</p>
          <span className="links-doodle" aria-hidden="true">↘</span>
        </motion.div>
        <div className="link-list">
          {socials.map((social, index) => (
            <motion.a className="social-link" href={social.href} key={social.name} target={social.external ? "_blank" : undefined} rel={social.external ? "noopener noreferrer" : undefined} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} transition={{ delay: reduceMotion ? 0 : index * 0.06 }}>
              <span className="social-name">{social.name}</span><span className="social-detail">{social.detail}</span><span className="social-arrow" aria-hidden="true">{social.arrow}</span>
            </motion.a>
          ))}
        </div>
      </section>

      <footer className="site-footer section-wrap">
        <a className="footer-brand" href="#home">Pkqa Center<span>.</span></a>
        <span className="footer-credit">© 2026 GloryPkqa <i>·</i> MADE WITH A LITTLE CURIOSITY</span>
        <a className="back-to-top" href="#home">回到顶部 <span>↑</span></a>
      </footer>
    </main>
  );
}
