"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpenText,
  ClipboardCheck,
  PackagePlus,
  Target,
  Users,
} from "lucide-react";
import { ErrorState, LoadingState, ProgressBar, directionLabels } from "@/components/management/ManagementUi";

type Category = {
  category_id: string;
  title: string;
  job_direction: string;
  summary?: string;
  instructions_md?: string;
  acceptance_criteria?: string;
  competency_ids_json?: string;
  source_type?: string;
  task_count: number;
  participant_count: number;
  completion_rate: number;
  average_cycle_days: number;
};

const competencyLabels: Record<string, string> = {
  "common-problem-definition": "问题定义",
  "common-delivery": "执行与交付",
  "common-communication": "沟通表达",
  "common-reflection": "复盘与改进",
  "ba-forecast": "经营预测",
  "ba-diagnosis": "经营诊断",
  "ba-market": "市场与竞品研究",
  "ba-storytelling": "商业汇报",
  "da-quality": "数据质量",
  "da-metrics": "指标体系",
  "da-analysis": "分析与实验",
  "da-automation": "看板与自动化",
  "quant-data": "市场数据处理",
  "quant-factor": "因子研究",
  "quant-backtest": "策略回测",
  "quant-risk": "风险收益与组合",
};

export default function TaskTemplateDetailPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const [items, setItems] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/task-categories")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || "加载失败");
        setItems(payload.categories || []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const category = useMemo(
    () => items.find((item) => item.category_id === categoryId),
    [categoryId, items],
  );

  if (error) return <ErrorState message={error} />;
  if (loading) return <LoadingState text="正在加载任务模板详情..." />;
  if (!category) return <ErrorState message="没有找到这个任务模板，可能已被删除或没有访问权限。" />;

  const isBuiltIn = category.category_id.startsWith("template-");
  const competencyIds = parseJsonArray(category.competency_ids_json);

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link href="/management/task-categories" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-700"><ArrowLeft className="h-4 w-4" />返回任务模板仓库</Link>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isBuiltIn ? "bg-gray-100 text-gray-600" : "bg-emerald-50 text-emerald-700"}`}>{isBuiltIn ? "内置模板" : "沉淀模板"}</span>
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">{directionLabels[category.job_direction] || category.job_direction}</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">{category.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{category.summary || "暂未填写适用场景说明。"}</p>
      </div>
      <Link href={`/management/tasks?create=1&categoryId=${encodeURIComponent(category.category_id)}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><PackagePlus className="h-4 w-4" />带入发布</Link>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={BookOpenText} label="发布次数" value={category.task_count} />
      <Metric icon={Users} label="参与实习生" value={category.participant_count} />
      <Metric icon={BadgeCheck} label="完成率" value={`${category.completion_rate}%`} />
      <Metric icon={Target} label="平均周期" value={category.average_cycle_days ? `${category.average_cycle_days}天` : "-"} />
    </div>

    <section className="border-y border-gray-200 py-6">
      <div className="flex items-center gap-2"><BookOpenText className="h-5 w-5 text-primary-600" /><h2 className="font-semibold text-gray-900">任务目标与交付</h2></div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">{category.instructions_md || "暂未填写任务目标与交付要求。"}</p>
    </section>

    <section className="border-b border-gray-200 pb-6">
      <div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-emerald-600" /><h2 className="font-semibold text-gray-900">验收要点</h2></div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">{category.acceptance_criteria || "暂未填写验收要点。"}</p>
    </section>

    <section className="border-b border-gray-200 pb-6">
      <div className="flex items-center gap-2"><Target className="h-5 w-5 text-amber-600" /><h2 className="font-semibold text-gray-900">能力覆盖</h2></div>
      {competencyIds.length ? <div className="mt-3 flex flex-wrap gap-2">{competencyIds.map((id) => <span key={id} className="rounded-full bg-amber-50 px-3 py-1.5 text-sm text-amber-800">{competencyLabels[id] || id}</span>)}</div> : <p className="mt-3 text-sm text-gray-500">该模板暂未配置能力标签，发布时仍会按任务内容和实习生能力画像给出匹配度参考。</p>}
    </section>

    <section className="border-b border-gray-200 pb-6">
      <div className="flex items-center justify-between text-sm text-gray-600"><span>模板完成率</span><strong className="text-gray-900">{category.completion_rate}%</strong></div>
      <div className="mt-3"><ProgressBar value={category.completion_rate} tone="bg-emerald-500" /></div>
    </section>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof BookOpenText; label: string; value: number | string }) {
  return <div className="border border-gray-200 bg-white p-4">
    <div className="flex items-center gap-2 text-sm text-gray-500"><Icon className="h-4 w-4 text-primary-600" />{label}</div>
    <p className="mt-3 text-2xl font-semibold text-gray-900">{value}</p>
  </div>;
}

function parseJsonArray(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
