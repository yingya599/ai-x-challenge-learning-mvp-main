"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  CheckCircle2,
  PlayCircle,
  Code2,
  Search,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { fetchChallenges } from "@/lib/api";
import type { Challenge } from "@/lib/data";

export default function LMSPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchChallenges().then((r) => {
      setChallenges(r.items);
      setLoading(false);
    });
  }, []);

  const filtered = challenges.filter((c) =>
    c.title.includes(search) || c.description.includes(search)
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        <p className="mt-3 text-sm text-gray-500">加载课程任务...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">学习管理</h1>
        <p className="mt-1 text-sm text-gray-500">
          共 {challenges.length} 个 Challenge 任务
        </p>
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="搜索任务..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {/* 任务列表 */}
      <div className="space-y-3">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/challenges/${c.id}`}
            className="block rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${
                  c.status === "已完成" ? "bg-green-50" : "bg-primary-50"
                }`}>
                  {c.status === "已完成" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <PlayCircle className="h-5 w-5 text-primary-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{c.title}</h3>
                  <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{c.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  c.status === "已完成" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
                }`}>
                  {c.status}
                </span>
                <ExternalLink className="h-4 w-4 text-gray-300" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Code2 className="mb-2 h-8 w-8" />
          <p className="text-sm">暂无任务</p>
        </div>
      )}
    </div>
  );
}
