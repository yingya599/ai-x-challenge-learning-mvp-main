"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, ListTodo, Users } from "lucide-react";
import { ErrorState, LoadingState, MetricCard, ProgressBar, directionLabels, riskLabels } from "@/components/management/ManagementUi";

type Overview = {
  scope: "global" | "mentor";
  metrics: { activeInterns: number; activeTasks: number; pendingReviews: number; riskAlerts: number; completionRate: number; onTimeRate: number };
  directions: Array<{ id: string; label: string; interns: number; tasks: number; completionRate: number }>;
  riskyTasks: Array<{ task_id: string; title: string; student_id: string; risk_status?: string; computed_risk?: string }>;
  recentCompleted: Array<{ task_id: string; title: string; student_id: string; updated_at?: string }>;
  mentorWorkload: Array<{ mentorId: string; name: string; interns: number; pendingReviews: number }>;
  usingLegacyTaskProjection: boolean;
};

export default function ManagementPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/management/overview").then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "加载失败");
      setData(payload.overview);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "加载失败"));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState text="正在汇总任务、人员与风险数据..." />;

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-600">{data.scope === "global" ? "领导视角" : "带教视角"}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">实习任务管理工作台</h1>
          <p className="mt-1 text-sm text-gray-500">聚焦人员进度、任务分配、任务验收和风险提醒，不在首页堆叠完整提交记录。</p>
        </div>
        <div className="flex gap-2">
          {data.scope === "global" && <Link href="/management/assignments" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">带教分配</Link>}
          <Link href="/management/tasks" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">查看个人任务</Link>
          <Link href="/management/tasks?create=1" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">创建个人任务</Link>
        </div>
      </div>

      {data.usingLegacyTaskProjection && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          当前使用历史 Challenge 与提交数据生成任务视图；配置 Tasks 表后会自动切换为真实个人任务。
        </div>
      )}

      {data.scope === "mentor" && data.metrics.activeInterns === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-medium">当前账号还没有分配实习生</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">带教账号只展示“带教ID”与当前账号一致的实习生。请由领导完成带教关系配置后再发布任务。</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard href="/management/interns" label="在岗实习生" value={data.metrics.activeInterns} hint="点击查看人员与任务情况" icon={Users} />
        <MetricCard href="/management/tasks?status=active" label="进行中任务" value={data.metrics.activeTasks} hint="含已分配、进行中与待验收" icon={ListTodo} tone="emerald" />
        <MetricCard href="/management/reviews" label="待验收" value={data.metrics.pendingReviews} hint="等待带教或领导终审" icon={ClipboardCheck} tone="amber" />
        <MetricCard href="/management/tasks?risk=risk" label="风险提醒" value={data.metrics.riskAlerts} hint="逾期、重复退回或无进展" icon={AlertTriangle} tone="rose" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">任务完成率</span><strong className="text-xl text-gray-900">{data.metrics.completionRate}%</strong></div>
          <div className="mt-3"><ProgressBar value={data.metrics.completionRate} tone="bg-emerald-500" /></div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">按期完成率</span><strong className="text-xl text-gray-900">{data.metrics.onTimeRate}%</strong></div>
          <div className="mt-3"><ProgressBar value={data.metrics.onTimeRate} /></div>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div><h2 className="font-semibold text-gray-900">三类岗位任务进度</h2><p className="mt-1 text-sm text-gray-500">按岗位查看参与人数、任务数量和任务完成率。</p></div>
          {data.scope === "global" && <Link href="/management/task-categories" className="text-sm font-medium text-primary-600">查看任务类别</Link>}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {data.directions.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center justify-between"><h3 className="font-medium text-gray-900">{directionLabels[item.id] || item.label}</h3><span className="text-xs text-gray-500">{item.interns} 人 · {item.tasks} 项</span></div>
              <div className="mt-4 text-xs text-gray-500">
                <div><div className="mb-1 flex justify-between"><span>任务完成率</span><span>{item.completionRate}%</span></div><ProgressBar value={item.completionRate} tone="bg-emerald-500" /></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4"><h2 className="flex items-center gap-2 font-semibold text-gray-900"><AlertTriangle className="h-4 w-4 text-rose-500" />风险任务</h2></div>
          <div className="divide-y divide-gray-100">
            {data.riskyTasks.length ? data.riskyTasks.map((task) => <Link key={task.task_id} href={`/management/tasks/${task.task_id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-gray-50"><span className="font-medium text-gray-800">{task.title}</span><span className="text-xs text-rose-600">{riskLabels[task.computed_risk || task.risk_status || ""] || "需要关注"}</span></Link>) : <p className="px-5 py-8 text-center text-sm text-gray-400">暂无风险任务</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4"><h2 className="flex items-center gap-2 font-semibold text-gray-900"><CheckCircle2 className="h-4 w-4 text-emerald-500" />最近完成</h2></div>
          <div className="divide-y divide-gray-100">
            {data.recentCompleted.length ? data.recentCompleted.map((task) => <Link key={task.task_id} href={`/management/tasks/${task.task_id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-gray-50"><span className="font-medium text-gray-800">{task.title}</span><span className="flex items-center gap-1 text-xs text-gray-400"><Clock3 className="h-3 w-3" />{task.updated_at?.slice(0, 10) || "已完成"}</span></Link>) : <p className="px-5 py-8 text-center text-sm text-gray-400">暂无已完成任务</p>}
          </div>
        </section>
      </div>

      {data.scope === "global" && data.mentorWorkload.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900">带教工作量</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.mentorWorkload.map((item) => <div key={item.mentorId} className="rounded-xl bg-gray-50 p-4"><p className="font-medium text-gray-900">{item.name}</p><p className="mt-2 text-sm text-gray-500">名下 {item.interns} 人 · 待验收 {item.pendingReviews} 项</p></div>)}
          </div>
        </section>
      )}
    </div>
  );
}
