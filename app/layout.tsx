import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NSEAP 智能教育平台",
  description: "Elite20 AI Native 课程学习平台 — 下一代 AI 教育操作系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
