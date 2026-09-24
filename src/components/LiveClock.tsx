"use client";

import { useSyncExternalStore } from "react";

const PLACEHOLDER = "----.--.-- --:--:--";

function formatLocalTime() {
  const now = new Date();
  const twoDigits = (value: number) => String(value).padStart(2, "0");

  return `${now.getFullYear()}.${twoDigits(now.getMonth() + 1)}.${twoDigits(now.getDate())} ${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}:${twoDigits(now.getSeconds())}`;
}

function subscribe(onChange: () => void) {
  let intervalId: number | undefined;
  const timeoutId = window.setTimeout(() => {
    onChange();
    intervalId = window.setInterval(onChange, 1000);
  }, 1000 - (Date.now() % 1000));

  const updateWhenVisible = () => {
    if (!document.hidden) onChange();
  };

  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", updateWhenVisible);

  return () => {
    window.clearTimeout(timeoutId);
    if (intervalId !== undefined) window.clearInterval(intervalId);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", updateWhenVisible);
  };
}

export default function LiveClock() {
  const localTime = useSyncExternalStore(subscribe, formatLocalTime, () => PLACEHOLDER);
  const dateTime = localTime === PLACEHOLDER ? undefined : localTime.replaceAll(".", "-").replace(" ", "T");

  return (
    <span className="hero-clock">
      <span className="hero-clock-label">本地时间</span>
      <time dateTime={dateTime}>{localTime}</time>
    </span>
  );
}
