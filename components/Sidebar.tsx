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
  ListTodo,
  ClipboardCheck,
  UserRoundCog,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[]; // T09: which roles can see this item
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Admin 管理控制台", icon: ShieldCheck, roles: ["admin"] },
  { href: "/management", label: "管理工作台", icon: LayoutDashboard, roles: ["teacher", "mentor", "leader", "ta"] },
  { href: "/management/interns", label: "实习生", icon: Users, roles: ["teacher", "mentor", "leader", "ta"] },
  { href: "/management/assignments", label: "带教分配", icon: UserRoundCog, roles: ["leader"] },
  { href: "/management/task-categories", label: "任务类别", icon: Library, roles: ["leader"] },
  { href: "/management/tasks", label: "个人任务", icon: ListTodo, roles: ["teacher", "mentor", "leader", "ta"] },
  { href: "/management/reviews", label: "任务验收", icon: ClipboardCheck, roles: ["teacher", "mentor", "leader", "ta"] },
  { href: "/dashboard", label: "我的概览", icon: LayoutDashboard, roles: ["student"] },
  { href: "/tasks", label: "我的任务", icon: ListTodo, roles: ["student", "agent"] },
  { href: "/submissions", label: "任务提交记录", icon: BookOpen, roles: ["student"] },
  { href: "/profile", label: "个人中心", icon: User, roles: ["student", "teacher", "mentor", "leader", "admin", "ta"] },
  { href: "/docs", label: "文档门户", icon: BookOpen, roles: ["student", "leader", "admin"] },
  { href: "/knowledge", label: "知识库", icon: Library, roles: ["student", "leader", "admin"] },
];

function navLabel(item: NavItem, role: string | null) {
  if (role === "teacher" || role === "mentor") {
    if (item.href === "/management") return "带教工作台";
    if (item.href === "/management/interns") return "我的实习生";
    if (item.href === "/management/reviews") return "待验收";
  }
  return item.label;
}

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

  const visibleItems = navItems.filter((item) => role ? item.roles.includes(role) : false);

  return (
    <>
    <aside className="hidden w-[var(--sidebar-width)] flex-col border-r border-gray-200 bg-white md:flex">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-100">
        <Sparkles className="h-6 w-6 text-primary-600" />
        <span className="text-lg font-bold text-gray-900">NSEAP</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/management" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? "sidebar-link-active" : "sidebar-link-inactive"}`}
            >
              <item.icon className="h-4 w-4" />
              {navLabel(item, role)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="text-xs text-gray-400">NSEAP v1.0 · Elite20</p>
      </div>
    </aside>
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-gray-200 bg-white px-1 py-2 md:hidden">
      {visibleItems.slice(0, 5).map((item) => {
        const isActive = pathname === item.href || (item.href !== "/management" && pathname.startsWith(`${item.href}/`));
        return (
          <Link key={item.href} href={item.href} className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-1 text-[10px] ${isActive ? "text-primary-600" : "text-gray-500"}`}>
            <item.icon className="h-4 w-4" />
            <span className="max-w-full truncate">{navLabel(item, role)}</span>
          </Link>
        );
      })}
    </nav>
    </>
  );
}
