"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  BriefcaseBusiness,
  Database,
  Filter,
  LineChart,
  PackagePlus,
  Plus,
  Search,
  X,
} from "lucide-react";
import { ErrorState, LoadingState, ProgressBar, directionLabels } from "@/components/management/ManagementUi";

type Category = {
  category_id: string;
  title: string;
  job_direction: string;
  summary?: string;
  source_type?: string;
  task_count: number;
  participant_count: number;
  completion_rate: number;
  average_cycle_days: number;
};

type TemplateForm = {
  title: string;
  job_direction: string;
  brief: string;
  objective: string;
  rubric: string;
};

const groups = ["business_analysis", "data_analysis", "quant"];
const icons = { business_analysis: BriefcaseBusiness, data_analysis: Database, quant: LineChart };
const emptyForm: TemplateForm = { title: "", job_direction: "data_analysis", brief: "", objective: "", rubric: "" };

export default function TaskCategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");

  const load = async () => {
    try {
      const [categoryResponse, userResponse] = await Promise.all([
        fetch("/api/task-categories"),
        fetch("/api/auth/me"),
      ]);
      const [categoryPayload, userPayload] = await Promise.all([
        categoryResponse.json(),
        userResponse.json(),
      ]);
      if (!categoryResponse.ok || !categoryPayload.ok) throw new Error(categoryPayload.error || "加载失败");
      setItems(categoryPayload.categories || []);
      setRole(userPayload.role || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const templates = useMemo(() => items.filter((item) => item.source_type !== "historical_challenge"), [items]);
  const filtered = useMemo(() => templates.filter((item) => {
    const text = `${item.title} ${item.summary || ""}`.toLowerCase();
    return (direction === "all" || item.job_direction === direction)
      && (!search || text.includes(search.toLowerCase()));
  }), [templates, direction, search]);
  const canCreate = ["teacher", "mentor", "leader"].includes(role);

  if (error) return <ErrorState message={error} />;
  if (loading) return <LoadingState text="正在加载任务模板仓库..." />;

  return <div className="space-y-7">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-primary-600">带教工具</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">任务模板仓库</h1>
        <p className="mt-1 text-sm text-gray-500">沉淀可复用的高频任务，发布给实习生前仍可结合个人能力匹配度确认。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowHistory((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><Archive className="h-4 w-4" />{showHistory ? "隐藏历史任务" : "历史任务"}</button>
        {canCreate && <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Plus className="h-4 w-4" />新增模板</button>}
      </div>
    </div>

    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 lg:flex-row">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索模板名称或适用场景..." className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-400" /></div>
      <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-gray-400" /><select value={direction} onChange={(event) => setDirection(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="all">全部岗位</option>{groups.map((group) => <option key={group} value={group}>{directionLabels[group]}</option>)}</select></div>
    </div>

    {groups.map((group) => {
      if (direction !== "all" && direction !== group) return null;
      const Icon = icons[group as keyof typeof icons];
      const categories = filtered.filter((item) => item.job_direction === group);
      return <section key={group} className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-primary-50 p-2 text-primary-600"><Icon className="h-5 w-5" /></span>
          <div><h2 className="font-semibold text-gray-900">{directionLabels[group]}</h2><p className="text-xs text-gray-500">{categories.length} 个可发布模板</p></div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((item) => <TemplateCard key={item.category_id} item={item} />)}
        </div>
        {!categories.length && <div className="mt-5 rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">暂无符合条件的模板</div>}
      </section>;
    })}

    {showHistory && <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6">
      <h2 className="font-semibold text-amber-900">历史任务</h2>
      <p className="mt-1 text-sm text-amber-700">旧 Challenge 数据只读保留，不混入默认模板仓库。</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.filter((item) => item.source_type === "historical_challenge").map((item) => <div key={item.category_id} className="rounded-xl border border-amber-100 bg-white p-4"><p className="font-medium text-gray-900">{item.title}</p><p className="mt-2 text-xs text-gray-500">{item.task_count} 项历史记录 · {item.participant_count} 人参与</p></div>)}
      </div>
    </section>}

    {showCreate && <CreateTemplateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load(); }} />}
  </div>;
}

function TemplateCard({ item }: { item: Category }) {
  const isBuiltIn = item.category_id.startsWith("template-");
  return <article className="rounded-xl border border-gray-100 bg-gray-50 p-4">
    <div className="flex items-start justify-between gap-3">
      <Link href={`/management/task-categories/${encodeURIComponent(item.category_id)}`} className="font-medium text-gray-900 hover:text-primary-700 hover:underline">{item.title}</Link>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${isBuiltIn ? "bg-white text-gray-500" : "bg-emerald-50 text-emerald-700"}`}>{isBuiltIn ? "内置模板" : "沉淀模板"}</span>
    </div>
    {item.summary && <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{item.summary}</p>}
    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
      <Stat label="发布" value={item.task_count} />
      <Stat label="参与" value={item.participant_count} />
      <Stat label="周期" value={item.average_cycle_days ? `${item.average_cycle_days}天` : "-"} />
    </div>
    <div className="mt-4">
      <div className="mb-1 flex justify-between text-xs text-gray-500"><span>完成率</span><span>{item.completion_rate}%</span></div>
      <ProgressBar value={item.completion_rate} tone="bg-emerald-500" />
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <Link href={`/management/task-categories/${encodeURIComponent(item.category_id)}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"><BookOpen className="h-4 w-4" />查看详情</Link>
      <Link href={`/management/tasks?create=1&categoryId=${encodeURIComponent(item.category_id)}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"><PackagePlus className="h-4 w-4" />带入发布</Link>
    </div>
  </article>;
}

function CreateTemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (key: keyof TemplateForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setMessage("");
    const response = await fetch("/api/task-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, source_type: "template" }),
    });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok || !payload.ok) { setMessage(payload.error || "模板创建失败"); return; }
    onCreated();
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
    <form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between">
        <div><h2 className="text-lg font-semibold text-gray-900">新增任务模板</h2><p className="mt-1 text-sm text-gray-500">把后续反复出现的任务沉淀到仓库，发布时可直接带入。</p></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="模板名称 *" wide><input required value={form.title} onChange={(event) => update("title", event.target.value)} className="input" placeholder="例如：月度收入预测分析" /></Field>
        <Field label="岗位方向 *"><select required value={form.job_direction} onChange={(event) => update("job_direction", event.target.value)} className="input">{groups.map((group) => <option key={group} value={group}>{directionLabels[group]}</option>)}</select></Field>
        <Field label="适用场景" wide><textarea value={form.brief} onChange={(event) => update("brief", event.target.value)} rows={3} className="input resize-y" placeholder="这个模板适合什么业务场景、输入材料和常见目标。" /></Field>
        <Field label="目标与交付" wide><textarea value={form.objective} onChange={(event) => update("objective", event.target.value)} rows={4} className="input resize-y" placeholder="说明任务目标、主要步骤、预期交付物。" /></Field>
        <Field label="验收要点" wide><textarea value={form.rubric} onChange={(event) => update("rubric", event.target.value)} rows={4} className="input resize-y" placeholder="说明完成标准、质量要求、需要带教重点检查的内容。" /></Field>
      </div>
      {message && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">取消</button>
        <button disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "保存中..." : "保存模板"}</button>
      </div>
    </form>
  </div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>{children}</label>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-lg bg-white px-2 py-2"><p className="text-sm font-semibold text-gray-900">{value}</p><p className="text-[11px] text-gray-400">{label}</p></div>;
}
