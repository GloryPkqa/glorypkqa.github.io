import type { Metadata } from "next";
import McWorkbench from "@/components/tools/McWorkbench";
import "./tools.css";

export const metadata: Metadata = {
  title: "MC 工具工坊 · Pkqa Center",
  description: "Minecraft 物品指令、附魔、颜色文字和坐标工具。为 Java 版不同版本生成可复制的结果。",
};

export default function ToolsPage() {
  return <McWorkbench />;
}
