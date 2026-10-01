import type { Metadata } from "next";
import McWorkbench from "@/components/tools/McWorkbench";
import "./tools.css";

export const metadata: Metadata = {
  title: "MC 工具工坊 · Pkqa Center",
  description: "Minecraft 指令生成、合成配方、颜色文字、坐标、服务器状态与玩家查询。支持多个 Java 版本。",
};

export default function ToolsPage() {
  return <McWorkbench />;
}
