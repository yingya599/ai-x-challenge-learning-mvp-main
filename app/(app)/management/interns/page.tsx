"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { ErrorState, LoadingState, directionLabels } from "@/components/management/ManagementUi";

type Intern = {
  student_id: string; name: string; department?: string; position?: string; school?: string; major?: string;
  mentor_name: string; days_on_job: number; completed_tasks: number; total_tasks: number; active_tasks: number;
  on_time_rate: number; last_activity_at?: string; risk_status: string; job_direction: string; status?: string;
};

export default function InternsPage() {
  const [items, setItems] = useState<Intern[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [risk, setRisk] = useState("all");
  useEffect(() => {
    fetch("/api/management/interns").then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "加载失败");
      setItems(payload.interns);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "加载失败")).finally(() => setLoading(false));
  }, []);
  const filtered = useMemo(() => items.filter((item) => {
    const text = `${item.name} ${item.department || ""} ${item.position || ""} ${item.school || ""} ${item.major || ""} ${item.mentor_name}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (direction === "all" || item.job_direction === direction) && (risk === "all" || item.risk_status === risk);
  }), [items, search, direction, risk]);
  if (error) return <ErrorState message={error} />;
  if (loading) return <LoadingState text="正在加载实习生档案与任务进度..." />;
  return (
    <div className="space-y-6">
      <div><p className="text-sm font-medium text-primary-600">人员视图</p><h1 className="mt-1 text-2xl font-bold text-gray-900">实习生列表</h1><p className="mt-1 text-sm text-gray-500">从人员维度查看岗位、带教、在岗时长、任务进度和风险状态。</p></div>
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 lg:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索姓名、岗位、学校或带教..." className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm" /></div>
        <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-gray-400" /><select value={direction} onChange={(event) => setDirection(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="all">全部岗位</option><option value="business_analysis">商业分析</option><option value="data_analysis">数据分析</option><option value="quant">量化</option></select><select value={risk} onChange={(event) => setRisk(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="all">全部风险</option><option value="normal">正常</option><option value="risk">需关注</option></select></div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full min-w-[1060px] text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500"><tr><th className="px-4 py-3">实习生</th><th className="px-4 py-3">岗位/部门</th><th className="px-4 py-3">学校/专业</th><th className="px-4 py-3">带教</th><th className="px-4 py-3">在岗</th><th className="px-4 py-3">任务进度</th><th className="px-4 py-3">按期率</th><th className="px-4 py-3">最近活动</th><th className="px-4 py-3">风险</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((item) => <tr key={item.student_id} className="hover:bg-gray-50"><td className="px-4 py-4"><Link href={`/management/interns/${encodeURIComponent(item.student_id)}`} className="font-medium text-primary-700 hover:underline">{item.name}</Link><p className="mt-0.5 font-mono text-xs text-gray-400">{item.student_id}</p></td><td className="px-4 py-4"><p className="font-medium text-gray-800">{item.position || directionLabels[item.job_direction]}</p><p className="text-xs text-gray-500">{item.department || "未填写部门"}</p></td><td className="px-4 py-4"><p>{item.school || "—"}</p><p className="text-xs text-gray-500">{item.major || "未填写专业"}</p></td><td className="px-4 py-4">{item.mentor_name}</td><td className="px-4 py-4">{item.days_on_job ? `${item.days_on_job} 天` : "待补日期"}</td><td className="px-4 py-4"><p className="font-medium">{item.completed_tasks}/{item.total_tasks} 完成</p><p className="text-xs text-gray-500">{item.active_tasks} 项进行中</p></td><td className="px-4 py-4">{item.on_time_rate}%</td><td className="px-4 py-4 text-xs text-gray-500">{item.last_activity_at?.slice(0, 10) || "暂无"}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs ${item.risk_status === "risk" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{item.risk_status === "risk" ? "需关注" : "正常"}</span></td></tr>)}
          </tbody>
        </table>
        {!filtered.length && <div className="py-12 text-center text-sm text-gray-400">没有符合当前筛选条件的实习生</div>}
      </div>
    </div>
  );
}
