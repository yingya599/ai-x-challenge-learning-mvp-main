"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrainCircuit, Target } from "lucide-react";
import { ErrorState, LoadingState, ProgressBar, TaskStatusBadge, directionLabels } from "@/components/management/ManagementUi";

type Task = { task_id: string; title: string; job_direction: string; status?: string; due_date?: string; mentor_name?: string };
type AssessmentDimension = { id: string; label: string; score: number; evidence_count: number };
type Growth = {
  job_direction: string;
  summary: { daysOnJob: number; completionRate: number; pendingTasks: number };
  capability: {
    coverage: number;
    profile_completeness: number;
    target_count: number;
    practiced_count: number;
    verified_count: number;
    summary: string;
    items: Array<{ competency_id: string; name: string; maturity: "verified" | "practiced" | "untouched"; evidence_count: number }>;
    assessment: {
      overall_score: number;
      level: string;
      stage_target_score: number;
      attainment_rate: number;
      trend: number;
      trend_label: string;
      strengths: string[];
      weaknesses: string[];
      next_steps: string[];
      generic_dimensions: AssessmentDimension[];
      evidence_confidence: "low" | "medium" | "high";
    };
  };
};

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [growth, setGrowth] = useState<Growth | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "加载失败");
        setTasks(payload.tasks || []);
        setGrowth(payload.growth || null);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (loading) return <LoadingState text="正在加载我的任务..." />;

  return <div className="space-y-6">
    <div><p className="text-sm font-medium text-primary-600">实习生任务</p><h1 className="mt-1 text-2xl font-bold text-gray-900">我的任务</h1><p className="mt-1 text-sm text-gray-500">查看任务要求、提交多类型成果并跟踪带教反馈。</p></div>
    {growth && <GrowthCard growth={growth} />}
    <div className="grid gap-4 lg:grid-cols-2">{tasks.map((task) => <Link key={task.task_id} href={`/tasks/${encodeURIComponent(task.task_id)}`} className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-primary-200 hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-medium text-primary-600">{directionLabels[task.job_direction]}</span><h2 className="mt-1 font-semibold text-gray-900">{task.title}</h2></div><TaskStatusBadge status={task.status} /></div><div className="mt-4 flex justify-between text-xs text-gray-500"><span>带教：{task.mentor_name || "未分配"}</span><span>截止：{task.due_date?.slice(0, 10) || "未设置"}</span></div></Link>)}</div>
    {!tasks.length && <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center text-sm text-gray-400">当前没有分配给你的任务</div>}
  </div>;
}

function GrowthCard({ growth }: { growth: Growth }) {
  const capability = growth.capability;
  const assessment = capability.assessment;
  return <section className="rounded-2xl border border-primary-200 bg-white p-5">
    <div className="flex items-start gap-3">
      <span className="rounded-xl bg-primary-50 p-2 text-primary-600"><BrainCircuit className="h-5 w-5" /></span>
      <div>
        <h2 className="font-semibold text-gray-900">我的成长进度</h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">{assessment.overall_score} 分 · {assessment.level} · 阶段目标达成 {assessment.attainment_rate}%</p>
      </div>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="综合实力" value={`${assessment.overall_score} 分`} hint={`${assessment.level} 等级`} />
      <Metric label="阶段目标" value={`${assessment.stage_target_score} 分`} hint={`达成率 ${assessment.attainment_rate}%`} progress={assessment.attainment_rate} />
      <Metric label="最近趋势" value={`${assessment.trend > 0 ? "+" : ""}${assessment.trend} 分`} hint={assessment.trend_label} />
      <Metric label="证据可信度" value={assessment.evidence_confidence === "high" ? "高" : assessment.evidence_confidence === "medium" ? "中" : "低"} hint={`${capability.verified_count}/${capability.target_count} 项能力已验收`} />
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {assessment.generic_dimensions.slice(0, 8).map((dimension) => <div key={dimension.id} className="rounded-xl bg-gray-50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-gray-900">{dimension.label}</span><span className="text-xs font-semibold text-gray-700">{dimension.score}/5</span></div><div className="mt-2"><ProgressBar value={dimension.score * 20} tone={dimension.score >= 3.5 ? "bg-emerald-500" : dimension.score >= 2 ? "bg-amber-500" : "bg-gray-400"} /></div><p className="mt-1 text-xs text-gray-500">{dimension.evidence_count ? `${dimension.evidence_count} 条相关证据` : "等待任务或验收沉淀"}</p></div>)}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-medium text-emerald-800">当前优势</p><p className="mt-1 text-xs leading-5 text-emerald-700">{assessment.strengths.slice(0, 2).join("；")}</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-xs font-medium text-amber-800">下一步</p><p className="mt-1 text-xs leading-5 text-amber-700">{assessment.next_steps.slice(0, 2).join("；")}</p></div></div>
    <p className="mt-4 flex items-center gap-1 text-xs text-gray-400"><Target className="h-3.5 w-3.5" />成长进度来自个人任务、提交和带教验收记录；任务匹配度仅对带教开放。</p>
  </section>;
}

function Metric({ label, value, hint, progress }: { label: string; value: string; hint: string; progress?: number }) {
  return <div className="rounded-xl bg-gray-50 p-4"><div className="flex items-center justify-between text-sm"><span className="text-gray-500">{label}</span><strong className="text-gray-900">{value}</strong></div><p className="mt-1 text-xs text-gray-500">{hint}</p>{progress !== undefined && <div className="mt-3"><ProgressBar value={progress} tone="bg-emerald-500" /></div>}</div>;
}

function MaturityBadge({ maturity }: { maturity: "verified" | "practiced" | "untouched" }) {
  const config = {
    verified: { label: "已验收", className: "bg-emerald-50 text-emerald-700" },
    practiced: { label: "做过", className: "bg-blue-50 text-blue-700" },
    untouched: { label: "待练习", className: "bg-gray-100 text-gray-600" },
  }[maturity];
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${config.className}`}>{config.label}</span>;
}
