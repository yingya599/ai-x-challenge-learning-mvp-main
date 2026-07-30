"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  GraduationCap,
  BookOpen,
  Users,
  CheckCircle2,
  TrendingUp,
  Clock,
  Loader2,
} from "lucide-react";
import { fetchDashboardStats, fetchMyPeerReviews, type DashboardStats, type PeerReviewItem } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingReviews, setPendingReviews] = useState<PeerReviewItem[]>([]);

  useEffect(() => {
    fetchDashboardStats().then((s) => {
      setStats(s);
      setLoading(false);
    });
    fetchMyPeerReviews().then((r) => {
      if (r.ok && r.evaluations) setPendingReviews(r.evaluations.filter((e) => e.pending));
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        <p className="mt-3 text-sm text-gray-500">加载中...</p>
      </div>
    );
  }

  const s = stats!;
  const progress = s.challengeCount > 0
    ? Math.round((s.completedCount / s.challengeCount) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">学生总数</p>
              <p className="text-2xl font-bold text-gray-900">{s.studentCount}</p>
            </div>
            <div className="rounded-lg bg-primary-50 p-2">
              <Users className="h-5 w-5 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Challenge 任务</p>
              <p className="text-2xl font-bold text-gray-900">{s.challengeCount}</p>
            </div>
            <div className="rounded-lg bg-primary-50 p-2">
              <BookOpen className="h-5 w-5 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">总提交数</p>
              <p className="text-2xl font-bold text-gray-900">{s.submissionCount}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">完成率</p>
              <p className="text-2xl font-bold text-gray-900">{progress}%</p>
            </div>
            <div className="rounded-lg bg-green-50 p-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100">
            <div className="h-1.5 rounded-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* 待我评审 (P2 同伴评审) */}
      {pendingReviews.length > 0 && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-5">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <CheckCircle2 className="h-5 w-5 text-purple-600" /> 待我评审（{pendingReviews.length}）
          </h3>
          <div className="mt-3 space-y-2">
            {pendingReviews.map((r) => (
              <Link key={r.evaluation_id} href={`/submissions/${r.submission_id}`}
                className="flex items-center justify-between rounded-lg border border-purple-100 bg-white px-4 py-3 text-sm hover:shadow-sm transition-all">
                <div>
                  <p className="font-medium text-gray-900">{r.project_title || r.submission_id}</p>
                  <p className="text-xs text-gray-500">提交人：{r.submitter_name || r.student_id}</p>
                </div>
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">去评审</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 快捷入口 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/challenges" className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2"><BookOpen className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="font-medium text-gray-900">查看 Challenge</p>
              <p className="text-xs text-gray-500">{s.challengeCount} 个任务可用</p>
            </div>
          </div>
        </Link>

        <Link href="/submit" className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2"><GraduationCap className="h-5 w-5 text-primary-600" /></div>
            <div>
              <p className="font-medium text-gray-900">提交项目</p>
              <p className="text-xs text-gray-500">已提交 {s.submissionCount} 次</p>
            </div>
          </div>
        </Link>

        <Link href="/portfolio" className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="font-medium text-gray-900">作品集</p>
              <p className="text-xs text-gray-500">{s.completedCount} 个完成</p>
            </div>
          </div>
        </Link>
      </div>

      {/* 待办提醒 */}
      {s.pendingReview > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              {s.pendingReview} 个提交等待评审
            </p>
            <Link href="/teacher" className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-800">
              去评审 →
            </Link>
          </div>
        </div>
      )}

      {!s.live && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
          数据来自本地缓存，登录后可查看实时数据
        </div>
      )}
    </div>
  );
}
