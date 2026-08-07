"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BrainCircuit, CheckCircle2, ClipboardList, Target } from "lucide-react";
import { ErrorState, LoadingState, ProgressBar, TaskStatusBadge, directionLabels } from "@/components/management/ManagementUi";

type Detail = {
  student: Record<string, string> & { student_id: string; name: string };
  job_direction: string;
  mentor: { name: string } | null;
  tasks: Array<Record<string, unknown> & { task_id: string; title: string; status?: string; due_date?: string; return_count?: number }>;
  submissions: Array<Record<string, unknown> & { submission_id: string; task_id?: string; project_title: string; submitted_at?: string; status?: string; result_summary?: string; project_summary?: string }>;
  evaluations: Array<{ evaluation_id: string; submission_id: string; score_total: number; feedback: string; evaluator_type: string }>;
  capability: {
    direction: string;
    profile_completeness: number;
    profile_signals: string[];
    summary: string;
    target_count: number;
    practiced_count: number;
    verified_count: number;
    coverage: number;
    items: Array<{ competency_id: string; name: string; description?: string; maturity: "verified" | "practiced" | "untouched"; evidence_count: number; assessment_level?: string }>;
    recommended_tasks: Array<{ category_id: string; title: string; summary?: string; source_type?: string; score: number; fit: "high" | "medium" | "stretch"; reasons: string[]; gaps: string[] }>;
  };
  summary: { daysOnJob: number; completionRate: number; pendingTasks: number };
};

const tabs = ["基本资料", "成长进度", "任务进度", "提交与反馈"] as const;

export default function InternDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof tabs)[number]>("基本资料");
  useEffect(() => {
    fetch(`/api/management/interns/${encodeURIComponent(studentId)}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "加载失败");
      setDetail(payload.detail);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "加载失败"));
  }, [studentId]);
  const evaluationMap = useMemo(() => new Map(detail?.evaluations.map((item) => [item.submission_id, item]) || []), [detail]);
  if (error) return <ErrorState message={error} />;
  if (!detail) return <LoadingState text="正在整理个人资料、任务和提交记录..." />;
  const { student, summary } = detail;
  return (
    <div className="space-y-6">
      <Link href="/management/interns" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft className="h-4 w-4" />返回实习生列表</Link>
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start"><div><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">{student.name.slice(0, 1)}</div><div><h1 className="text-2xl font-bold text-gray-900">{student.name}</h1><p className="mt-1 text-sm text-gray-500">{student.department || "未填写部门"} · {student.position || directionLabels[detail.job_direction]} · 带教：{detail.mentor?.name || "未分配"}</p></div></div></div><Link href={`/management/tasks?studentId=${encodeURIComponent(student.student_id)}`} className="rounded-lg bg-primary-600 px-4 py-2 text-center text-sm font-medium text-white">查看全部个人任务</Link></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          ["在岗天数", summary.daysOnJob ? `${summary.daysOnJob} 天` : "待补日期"], ["任务完成率", `${summary.completionRate}%`], ["已完成任务", detail.tasks.filter((item) => item.status === "accepted").length], ["待完成任务", summary.pendingTasks],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-gray-50 p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-gray-900">{value}</p></div>)}</div>
      </section>
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${tab === item ? "bg-primary-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>{item}</button>)}</div>

      {tab === "基本资料" && <section className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-6 md:grid-cols-2"><Info label="部门" value={student.department} /><Info label="岗位" value={student.position || directionLabels[detail.job_direction]} /><Info label="学校" value={student.school} /><Info label="专业" value={student.major} /><Info label="带教人" value={detail.mentor?.name} /><Info label="入职日期" value={student.internship_start_date} /><Info label="预计结束日期" value={student.internship_end_date} /><Info label="状态" value={student.status || "在岗"} /></section>}

      {tab === "成长进度" && <CapabilityView capability={detail.capability} />}

      {tab === "任务进度" && <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white"><div className="divide-y divide-gray-100">{detail.tasks.map((task) => <Link key={task.task_id} href={`/management/tasks/${encodeURIComponent(task.task_id)}`} className="flex flex-col justify-between gap-3 px-5 py-4 hover:bg-gray-50 sm:flex-row sm:items-center"><div><p className="font-medium text-gray-900">{task.title}</p><p className="mt-1 text-xs text-gray-500">截止 {task.due_date?.slice(0, 10) || "未设置"} · 退回 {task.return_count || 0} 次</p></div><TaskStatusBadge status={task.status} /></Link>)}{!detail.tasks.length && <p className="py-12 text-center text-sm text-gray-400">尚未分配个人任务</p>}</div></section>}

      {tab === "提交与反馈" && <section className="space-y-4">{detail.submissions.map((submission) => { const evaluation = evaluationMap.get(submission.submission_id); return <article key={submission.submission_id} className="rounded-2xl border border-gray-200 bg-white p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h3 className="font-semibold text-gray-900">{submission.project_title}</h3><p className="mt-1 text-xs text-gray-500">提交于 {submission.submitted_at?.slice(0, 16).replace("T", " ") || "未知"} · {submission.submission_id}</p></div><Link href={`/teacher/reviews/${encodeURIComponent(submission.submission_id)}`} className="text-sm font-medium text-primary-600">查看完整证据与验收</Link></div><p className="mt-4 text-sm leading-6 text-gray-600">{submission.result_summary || submission.project_summary || "未填写成果摘要"}</p>{evaluation && <div className="mt-4 rounded-xl bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4" />带教终审 · {evaluation.score_total} 分</div><p className="mt-2 text-sm text-emerald-700">{evaluation.feedback}</p></div>}</article>; })}{!detail.submissions.length && <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center text-sm text-gray-400"><ClipboardList className="mx-auto mb-2 h-6 w-6" />暂无提交记录</div>}</section>}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div><dt className="text-xs font-medium text-gray-500">{label}</dt><dd className="mt-1 text-sm text-gray-900">{value || "未填写"}</dd></div>;
}

function CapabilityView({ capability }: { capability: Detail["capability"] }) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary-700"><BrainCircuit className="h-4 w-4" />成长进度</div>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">{directionLabels[capability.direction] || capability.direction}能力成长</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{capability.summary}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-4"><div className="flex items-center justify-between text-sm"><span className="text-gray-500">能力覆盖</span><strong className="text-gray-900">{capability.coverage}%</strong></div><div className="mt-3"><ProgressBar value={capability.coverage} tone="bg-emerald-500" /></div><p className="mt-2 text-xs text-gray-400">带教验收通过的目标能力</p></div>
          <div className="rounded-xl bg-gray-50 p-4"><div className="flex items-center justify-between text-sm"><span className="text-gray-500">练习 / 目标</span><strong className="text-gray-900">{capability.practiced_count} / {capability.target_count}</strong></div><p className="mt-5 text-xs text-gray-400">已有任务中出现过的能力</p></div>
          <div className="rounded-xl bg-gray-50 p-4"><div className="flex items-center justify-between text-sm"><span className="text-gray-500">资料完整度</span><strong className="text-gray-900">{capability.profile_completeness}%</strong></div><div className="mt-3"><ProgressBar value={capability.profile_completeness} /></div><p className="mt-2 text-xs text-gray-400">岗位、专业、学校和作品入口</p></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">{capability.profile_signals.map((signal) => <span key={signal} className="rounded-full bg-primary-50 px-3 py-1.5 text-xs text-primary-800">{signal}</span>)}</div>
        <p className="mt-4 text-xs leading-5 text-gray-400">成长进度依据当前档案字段、任务能力映射和带教验收记录计算；补充简历字段并完成验收后会自动更新。</p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2"><Target className="h-5 w-5 text-primary-600" /><div><h2 className="font-semibold text-gray-900">能力状态</h2><p className="mt-1 text-xs text-gray-500">把“做过”与“已被带教确认”分开显示。</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {capability.items.map((item) => <div key={item.competency_id} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-900">{item.name}</p><p className="mt-1 text-xs text-gray-500">{item.evidence_count ? `${item.evidence_count} 条相关证据` : "尚无相关证据"}</p></div><MaturityBadge maturity={item.maturity} /></div>{item.description && <p className="mt-3 text-xs leading-5 text-gray-500">{item.description}</p>}</div>)}
        </div>
      </section>

    </div>
  );
}

function MaturityBadge({ maturity }: { maturity: "verified" | "practiced" | "untouched" }) {
  const config = {
    verified: { label: "已验收", className: "bg-emerald-50 text-emerald-700" },
    practiced: { label: "做过", className: "bg-blue-50 text-blue-700" },
    untouched: { label: "待练习", className: "bg-gray-100 text-gray-600" },
  }[maturity];
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${config.className}`}>{config.label}</span>;
}
