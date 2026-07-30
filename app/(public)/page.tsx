"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  GraduationCap,
  Bot,
  GitBranch,
  BookOpen,
  Library,
  ChevronRight,
  Users,
  Target,
  Cpu,
  ArrowRight,
} from "lucide-react";

const features = [
  { icon: Bot, title: "AI Native 架构", description: "基于认知细胞（Cognitive Cell）架构，一切皆 Agent。" },
  { icon: Target, title: "PBL 挑战驱动", description: "10 个渐进式 Builder Challenge，每个产出可交付的系统模块。" },
  { icon: Cpu, title: "KSTAR 进化循环", description: "每个 Agent 遵循 Learn→Execute→Evaluate→Reflect 进化循环。" },
  { icon: GitBranch, title: "开源协作", description: "7 个 Builder Team 并行推进，GitHub 协作 + AI 辅助开发。" },
  { icon: BookOpen, title: "完整课程体系", description: "10 周课程涵盖 Vibe Coding、AI Agent、企业部署全栈技能。" },
  { icon: Library, title: "统一知识库", description: "课程资料、FAQ、Prompt 库、最佳实践全部可检索可问答。" },
];

const teams = [
  { name: "课程组", role: "Curriculum", desc: "设计 Syllabus、Lecture、Slides" },
  { name: "挑战组", role: "Challenge", desc: "设计 PBL Challenge 和评估标准" },
  { name: "Agent 组", role: "Agent", desc: "开发课程 Agent 和智能助手" },
  { name: "本体组", role: "Ontology", desc: "构建技能本体论和知识图谱" },
  { name: "平台组", role: "Platform", desc: "GitHub、Website、LMS、部署" },
  { name: "知识组", role: "Knowledge", desc: "文档、教程、Prompt 库、视频" },
  { name: "Demo 组", role: "Demo", desc: "演示、宣传、产品化" },
];

const stats = [
  { label: "Builder 团队", value: "7" },
  { label: "课程模块", value: "10" },
  { label: "PBL 挑战", value: "10" },
  { label: "Agent 类型", value: "7+" },
];

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>("student");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setLoggedIn(d.ok);
        if (d.ok) setUserRole(d.role || "student");
      })
      .catch(() => setLoggedIn(false));
  }, []);

  const dashboardHref = userRole === "student" ? "/dashboard" : "/teacher";

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary-600" />
            <span className="text-lg font-bold text-gray-900">NSEAP</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900">特性</a>
            <a href="#course" className="text-sm text-gray-600 hover:text-gray-900">课程</a>
            <a href="#teams" className="text-sm text-gray-600 hover:text-gray-900">团队</a>
            {loggedIn === true ? (
              <Link
                href={dashboardHref}
                className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
              >
                进入控制台
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-gray-100">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-purple-50" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700">
              <Sparkles className="h-4 w-4" />
              Elite20 Builder Program
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              NSEAP{" "}
              <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                智能教育平台
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-600 sm:text-xl">
              基于认知细胞架构的 AI Native 教育操作系统。
              一切皆 Agent，从课程设计到企业部署，重新定义下一代智能教育。
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              {loggedIn === true ? (
                <Link
                  href={dashboardHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-white hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200"
                >
                  进入控制台 <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-white hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200"
                >
                  登录平台 <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-base font-medium text-gray-700 hover:border-gray-300 transition-colors"
              >
                了解更多
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">平台核心能力</h2>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-primary-200 hover:shadow-md">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-100 transition-colors">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 bg-white py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary-600" />
              <span className="text-sm font-bold text-gray-900">NSEAP</span>
            </div>
            <p className="text-sm text-gray-400">NSEAP v1.0 · Elite20 Builder Program</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
