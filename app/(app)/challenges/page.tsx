"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import { fetchChallenges } from "@/lib/api";
import type { Challenge } from "@/lib/data";

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void fetchChallenges().then((result) => {
      if (!result.live) {
        setError("真实 Challenge 数据加载失败，请稍后重试。");
        setChallenges([]);
      } else {
        setChallenges(result.items);
      }
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return challenges;
    return challenges.filter((challenge) =>
      [challenge.number, challenge.title, challenge.description]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [challenges, search]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <p className="mt-3 text-sm">正在加载 Challenge 列表...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
        <h1 className="mt-3 text-base font-semibold text-red-900">
          Challenge 列表加载失败
        </h1>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Challenge 详情</h1>
        <p className="mt-1 text-sm text-gray-500">
          点击任意 Challenge 查看目标、交付物、评分标准与相关资料。
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索 Challenge..."
          className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {filtered.map((challenge) => (
          <Link
            key={challenge.id}
            href={`/challenges/${encodeURIComponent(challenge.id)}`}
            className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-primary-50/60 focus:bg-primary-50/60 focus:outline-none"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-primary-50 p-2 text-primary-600">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">
                    {challenge.number || challenge.id}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                    {challenge.status}
                  </span>
                </div>
                <h2 className="mt-1 font-medium text-gray-900">
                  {challenge.title}
                </h2>
                {challenge.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                    {challenge.description}
                  </p>
                )}
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary-600">
              查看详情
              <ChevronRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          没有找到匹配的 Challenge。
        </div>
      )}
    </div>
  );
}
