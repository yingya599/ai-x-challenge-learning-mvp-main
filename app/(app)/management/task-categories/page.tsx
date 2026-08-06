"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, BriefcaseBusiness, Database, LineChart } from "lucide-react";
import { ErrorState, LoadingState, ProgressBar, directionLabels } from "@/components/management/ManagementUi";

type Category = { category_id: string; title: string; job_direction: string; summary?: string; source_type?: string; task_count: number; participant_count: number; completion_rate: number; average_cycle_days: number };
const groups = ["business_analysis", "data_analysis", "quant"];
const icons = { business_analysis: BriefcaseBusiness, data_analysis: Database, quant: LineChart };

export default function TaskCategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => { fetch("/api/task-categories").then(async (response) => { const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || "加载失败"); setItems(payload.categories); }).catch((reason) => setError(reason instanceof Error ? reason.message : "加载失败")).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => items.filter((item) => showHistory ? true : item.source_type !== "historical_challenge"), [items, showHistory]);
  if (error) return <ErrorState message={error} />;
  if (loading) return <LoadingState text="正在加载任务类别与历史培训任务..." />;
  return <div className="space-y-7">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-primary-600">任务体系</p><h1 className="mt-1 text-2xl font-bold text-gray-900">任务类别</h1><p className="mt-1 text-sm text-gray-500">类别定义通用目标和交付标准，真实业务内容通过个人任务单独分配。</p></div><button onClick={() => setShowHistory((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700"><Archive className="h-4 w-4" />{showHistory ? "隐藏历史培训任务" : "查看历史培训任务"}</button></div>
    {groups.map((group) => { const Icon = icons[group as keyof typeof icons]; const categories = visible.filter((item) => item.job_direction === group && item.source_type !== "historical_challenge"); return <section key={group} className="rounded-2xl border border-gray-200 bg-white p-6"><div className="flex items-center gap-3"><span className="rounded-xl bg-primary-50 p-2 text-primary-600"><Icon className="h-5 w-5" /></span><div><h2 className="font-semibold text-gray-900">{directionLabels[group]}</h2><p className="text-xs text-gray-500">{categories.length} 个首期任务类别</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{categories.map((item) => <article key={item.category_id} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-medium text-gray-900">{item.title}</h3><span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-500">{item.source_type === "template" ? "标准模板" : "业务类别"}</span></div>{item.summary && <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{item.summary}</p>}<div className="mt-4 grid grid-cols-3 gap-2 text-center"><Stat label="任务" value={item.task_count} /><Stat label="参与" value={item.participant_count} /><Stat label="周期" value={item.average_cycle_days ? `${item.average_cycle_days}天` : "—"} /></div><div className="mt-4"><div className="mb-1 flex justify-between text-xs text-gray-500"><span>完成率</span><span>{item.completion_rate}%</span></div><ProgressBar value={item.completion_rate} tone="bg-emerald-500" /></div></article>)}</div></section>; })}
    {showHistory && <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6"><h2 className="font-semibold text-amber-900">历史培训任务</h2><p className="mt-1 text-sm text-amber-700">旧 Challenge 数据只读保留，不与真实业务任务混在默认列表中。</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.filter((item) => item.source_type === "historical_challenge").map((item) => <div key={item.category_id} className="rounded-xl border border-amber-100 bg-white p-4"><p className="font-medium text-gray-900">{item.title}</p><p className="mt-2 text-xs text-gray-500">{item.task_count} 项历史记录 · {item.participant_count} 人参与</p></div>)}</div></section>}
  </div>;
}

function Stat({ label, value }: { label: string; value: number | string }) { return <div className="rounded-lg bg-white px-2 py-2"><p className="text-sm font-semibold text-gray-900">{value}</p><p className="text-[11px] text-gray-400">{label}</p></div>; }
