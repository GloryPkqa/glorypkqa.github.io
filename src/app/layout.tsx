import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "./preview.css";
import "./interactions.css";

const siteUrl = "https://pkqa.top/";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Pkqa Center",
  description: "GloryPkqa 的个人主页，记录喜欢的游戏、音乐和一些有意思的东西。",
  openGraph: {
    title: "Pkqa Center",
    description: "Welcome to my little corner of the internet.",
    url: siteUrl,
    siteName: "Pkqa Center",
    locale: "zh_CN",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <Script id="theme-preference" src="/theme-init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
