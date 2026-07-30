"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Github,
  Star,
  Award,
  Eye,
  EyeOff,
  Search,
  Clock,
  TrendingUp,
  Loader2,
  PackageOpen,
} from "lucide-react";
import type { PortfolioItem } from "@/lib/data";
import { fetchPortfolio } from "@/lib/api";

export default function PortfolioPage() {
  const [search, setSearch] = useState("");
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [showPublicOnly, setShowPublicOnly] = useState(false);

  useEffect(() => {
    fetchPortfolio().then((r) => {
      setPortfolioItems(r.items);
      setLive(r.live);
      setLoading(false);
    });
  }, []);

  const filtered = portfolioItems.filter((item) => {
    const matchesSearch =
      item.studentName.includes(search) ||
      item.challengeTitle.includes(search) ||
      item.summary.includes(search) ||
      item.techStack.some((t) => t.includes(search));
    const matchesVisibility = !showPublicOnly || item.isPublic;
    return matchesSearch && matchesVisibility;
  });

  const publicCount = portfolioItems.filter((p) => p.isPublic).length;
  const avgScore = portfolioItems.length > 0
    ? Math.round(portfolioItems.reduce((a, b) => a + b.aiScore, 0) / portfolioItems.length)
    : 0;

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        <p className="mt-3 text-sm text-gray-500">加载作品中...</p>
      </div>
    );
  }

  // Empty state
  if (portfolioItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <PackageOpen className="h-12 w-12 text-gray-300" />
        <p className="mt-4 text-sm font-medium text-gray-500">暂无作品</p>
        <p className="mt-1 text-xs text-gray-400">
          {live ? "提交项目后，作品将在这里展示" : "无法连接服务器，请稍后重试"}
        </p>
        <Link
          href="/submit"
          className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
        >
          提交项目
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">作品集</h1>
          <p className="mt-1 text-sm text-gray-500">
            共 {portfolioItems.length} 个作品 · {publicCount} 个公开
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPublicOnly(!showPublicOnly)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              showPublicOnly
                ? "border-primary-300 bg-primary-50 text-primary-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {showPublicOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            仅公开
          </button>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">总作品数</p>
              <p className="text-2xl font-bold text-gray-900">{portfolioItems.length}</p>
            </div>
            <div className="rounded-lg bg-primary-50 p-2"><Award className="h-5 w-5 text-primary-600" /></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">公开作品</p>
              <p className="text-2xl font-bold text-gray-900">{publicCount}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-2"><Eye className="h-5 w-5 text-green-600" /></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">平均 AI 评分</p>
              <p className="text-2xl font-bold text-gray-900">{avgScore}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2"><TrendingUp className="h-5 w-5 text-amber-600" /></div>
          </div>
        </div>
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="搜索作品、作者、技术栈..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
      </div>

      {/* 作品卡片 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <div key={item.id} className="group rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  item.isPublic ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>{item.isPublic ? "公开" : "内部"}</span>
                <span className="text-xs text-gray-400">{item.submittedAt}</span>
              </div>
              <Link href={`/submissions?challenge=${item.challengeId}`} className="text-primary-600 hover:text-primary-700">
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <h3 className="mt-3 font-medium text-gray-900">{item.challengeTitle}</h3>
            <p className="mt-1 text-xs text-gray-500">{item.studentName}</p>
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">{item.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {item.techStack.map((tech) => (
                <span key={tech} className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tech}</span>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" /> AI {item.aiScore}</span>
                {item.teacherScore && <span className="flex items-center gap-1"><Award className="h-3 w-3 text-primary-500" /> 教师 {item.teacherScore}</span>}
              </div>
              <a href={`https://github.com/${item.githubRepo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <Github className="h-3 w-3" /> 仓库
              </a>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Search className="mb-2 h-8 w-8" />
          <p className="text-sm">未找到匹配的作品</p>
        </div>
      )}
    </div>
  );
}
