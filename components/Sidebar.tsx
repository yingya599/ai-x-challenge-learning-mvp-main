"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  Github,
  BookOpen,
  Library,
  Sparkles,
  Send,
  Award,
  Users,
  User,
  ShieldCheck,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[]; // T09: which roles can see this item
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Admin 管理控制台", icon: ShieldCheck, roles: ["admin"] },
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard, roles: ["student", "teacher", "admin", "ta"] },
  { href: "/lms", label: "LMS 学习管理", icon: GraduationCap, roles: ["student", "teacher", "admin"] },
  { href: "/submit", label: "提交 Challenge", icon: Send, roles: ["student"] },
  { href: "/submissions", label: "提交记录", icon: BookOpen, roles: ["student", "teacher", "admin"] },
  { href: "/portfolio", label: "作品集", icon: Award, roles: ["student", "teacher", "admin"] },
  { href: "/teacher", label: "教师控制台", icon: Users, roles: ["teacher", "admin", "ta"] },
  { href: "/profile", label: "个人中心", icon: User, roles: ["student", "teacher", "admin", "ta"] },
  { href: "/github", label: "GitHub 组织", icon: Github, roles: ["student", "teacher", "admin"] },
  { href: "/docs", label: "文档门户", icon: BookOpen, roles: ["student", "teacher", "admin"] },
  { href: "/knowledge", label: "知识库", icon: Library, roles: ["student", "teacher", "admin"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setRole(d.role || "student");
      })
      .catch(() => setRole("student"));
  }, []);

  const visibleItems = navItems.filter((item) => !role || item.roles.includes(role));

  return (
    <aside className="flex w-[var(--sidebar-width)] flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-100">
        <Sparkles className="h-6 w-6 text-primary-600" />
        <span className="text-lg font-bold text-gray-900">NSEAP</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? "sidebar-link-active" : "sidebar-link-inactive"}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-xs text-gray-400">NSEAP v1.0 · Elite20</p>
      </div>
    </aside>
  );
}
