"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrainCircuit, Target } from "lucide-react";
import { ErrorState, LoadingState, ProgressBar, TaskStatusBadge, directionLabels } from "@/components/management/ManagementUi";

type Task = { task_id: string; title: string; job_direction: string; status?: string; due_date?: string; mentor_name?: string };
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
  return <section className="rounded-2xl border border-primary-200 bg-white p-5">
    <div className="flex items-start gap-3">
      <span className="rounded-xl bg-primary-50 p-2 text-primary-600"><BrainCircuit className="h-5 w-5" /></span>
      <div>
        <h2 className="font-semibold text-gray-900">我的成长进度</h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">{capability.summary}</p>
      </div>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-3">
      <Metric label="能力覆盖" value={`${capability.coverage}%`} progress={capability.coverage} />
      <Metric label="练习 / 目标" value={`${capability.practiced_count} / ${capability.target_count}`} />
      <Metric label="资料完整度" value={`${capability.profile_completeness}%`} progress={capability.profile_completeness} />
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {capability.items.slice(0, 6).map((item) => <div key={item.competency_id} className="rounded-xl bg-gray-50 p-3 text-sm"><div className="flex items-center justify-between gap-2"><span className="font-medium text-gray-900">{item.name}</span><MaturityBadge maturity={item.maturity} /></div><p className="mt-1 text-xs text-gray-500">{item.evidence_count ? `${item.evidence_count} 条相关证据` : "等待任务或验收沉淀"}</p></div>)}
    </div>
    <p className="mt-4 flex items-center gap-1 text-xs text-gray-400"><Target className="h-3.5 w-3.5" />成长进度来自个人任务、提交和带教验收记录。</p>
  </section>;
}

function Metric({ label, value, progress }: { label: string; value: string; progress?: number }) {
  return <div className="rounded-xl bg-gray-50 p-4"><div className="flex items-center justify-between text-sm"><span className="text-gray-500">{label}</span><strong className="text-gray-900">{value}</strong></div>{progress !== undefined && <div className="mt-3"><ProgressBar value={progress} tone="bg-emerald-500" /></div>}</div>;
}

function MaturityBadge({ maturity }: { maturity: "verified" | "practiced" | "untouched" }) {
  const config = {
    verified: { label: "已验收", className: "bg-emerald-50 text-emerald-700" },
    practiced: { label: "做过", className: "bg-blue-50 text-blue-700" },
    untouched: { label: "待练习", className: "bg-gray-100 text-gray-600" },
  }[maturity];
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${config.className}`}>{config.label}</span>;
}
