"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2, ChevronRight, Github, Calendar, Clock,
  CheckCircle2, XCircle, TrendingUp, Search,
} from "lucide-react";
import { fetchSubmissions, type SubmissionListItem } from "@/lib/api";
import { formatDateShort } from "@/lib/format";

const statusMap: Record<string, string> = {
  submitted: "已提交",
  checking: "检查中",
  pending_review: "待评审",
  reviewed: "已评分",
  accepted: "已通过",
  needs_revision: "需修改",
};

function statusLabel(s: SubmissionListItem): string {
  const st = s.status || "";
  if (st === "accepted" || st === "reviewed") return "已通过";
  if (st.includes("revision")) return "需修改";
  if (st.includes("review")) return "待评审";
  if (st === "submitted") return "已提交";
  return statusMap[st] || st || "已提交";
}

function statusColor(label: string): string {
  if (label === "已通过") return "bg-green-50 text-green-700";
  if (label === "需修改") return "bg-red-50 text-red-700";
  if (label === "待评审") return "bg-purple-50 text-purple-700";
  return "bg-blue-50 text-blue-700";
}

export default function SubmissionsPage() {
  const [subs, setSubs] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchSubmissions().then((r) => {
      if (r.ok && r.submissions) setSubs(r.submissions);
      setLoading(false);
    });
  }, []);

  const filtered = subs.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.project_title?.toLowerCase().includes(q) ||
      s.student_name?.toLowerCase().includes(q) ||
      s.github_repo_url?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Loader2 className="mb-2 h-8 w-8 animate-spin" />
        <p className="text-sm">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">提交记录</h1>
        <p className="mt-1 text-sm text-gray-500">
          共 {subs.length} 条提交记录，点击查看 AI 评分详情
        </p>
      </div>

      {subs.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索项目名称、仓库..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <Calendar className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {subs.length === 0 ? "暂无提交记录" : "没有匹配的提交"}
          </p>
          {subs.length === 0 && (
            <Link
              href="/submit"
              className="mt-4 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
            >
              去提交第一个 Challenge →
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">项目</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">仓库</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">提交时间</th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">AI 评分</th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s) => {
                  const label = statusLabel(s);
                  return (
                    <tr key={s.submission_id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">{s.project_title}</p>
                      </td>
                      <td className="px-5 py-4">
                        {s.github_repo_url ? (
                          <a
                            href={s.github_repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                          >
                            <Github className="h-3 w-3" />
                            {s.github_repo_url.replace(/^https?:\/\/github\.com\//, "").substring(0, 25)}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {formatDateShort(s.submitted_at)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {(s.score_total || 0) > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              s.score_total! >= 80
                                ? "bg-green-50 text-green-700"
                                : s.score_total! >= 60
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            <TrendingUp className="h-3 w-3" />
                            {s.score_total}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(label)}`}
                        >
                          {label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/submissions/${s.submission_id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                        >
                          详情 <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
