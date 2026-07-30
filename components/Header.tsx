"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Search, User, LogOut } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/admin": "NSEAP 管理控制台",
  "/dashboard": "仪表盘",
  "/lms": "LMS 学习管理系统",
  "/github": "GitHub 组织",
  "/docs": "文档门户",
  "/knowledge": "知识库",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitles[pathname] || "NSEAP 智能教育平台";
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.name) setUserName(d.name);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">Elite20 Builder Program</p>
      </div>
      <div className="flex items-center gap-4">
        <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <Search className="h-5 w-5" />
        </button>
        <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <User className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-gray-700">
            {userName || "..."}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="ml-2 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="登出"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
