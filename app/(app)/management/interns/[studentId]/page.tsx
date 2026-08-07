"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, BrainCircuit, CheckCircle2, ClipboardList, Lightbulb, Target, TrendingUp } from "lucide-react";
import { ErrorState, LoadingState, ProgressBar, TaskStatusBadge, directionLabels } from "@/components/management/ManagementUi";

type AssessmentDimension = { id: string; label: string; score: number; weight?: number; evidence_count: number; evidence: string[] };
type RoleExample = { role: string; role_label: string; overall_score: number; level: string; highlights: string[] };
type Assessment = {
  intern_id: string;
  role: string;
  job_direction: string;
  role_label: string;
  overall_score: number;
  level: string;
  stage_target_score: number;
  attainment_rate: number;
  trend: number;
  trend_label: string;
  evidence_confidence: "low" | "medium" | "high";
  summary: string;
  score_explanation: string[];
  evidence: string[];
  strengths: string[];
  weaknesses: string[];
  next_steps: string[];
  mentor_advice: string[];
  risk_alerts: string[];
  generic_dimensions: AssessmentDimension[];
  role_dimensions: AssessmentDimension[];
  task_stats: { assigned_count: number; active_count: number; accepted_count: number; returned_count: number; submission_count: number; teacher_evaluation_count: number; completion_rate: number; average_teacher_score: number };
  role_examples: RoleExample[];
};

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
    recommended_tasks: Array<{ category_id: string; title: string; summary?: string; source_type?: string; score: number; fit: "high" | "medium" | "stretch"; allocation_label: string; reasons: string[]; gaps: string[]; risks: string[]; mentor_action: string }>;
    assessment: Assessment;
    ai_assessment: Record<string, unknown>;
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

      {tab === "成长进度" && <CapabilityView capability={detail.capability} studentId={student.student_id} />}

      {tab === "任务进度" && <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white"><div className="divide-y divide-gray-100">{detail.tasks.map((task) => <Link key={task.task_id} href={`/management/tasks/${encodeURIComponent(task.task_id)}`} className="flex flex-col justify-between gap-3 px-5 py-4 hover:bg-gray-50 sm:flex-row sm:items-center"><div><p className="font-medium text-gray-900">{task.title}</p><p className="mt-1 text-xs text-gray-500">截止 {task.due_date?.slice(0, 10) || "未设置"} · 退回 {task.return_count || 0} 次</p></div><TaskStatusBadge status={task.status} /></Link>)}{!detail.tasks.length && <p className="py-12 text-center text-sm text-gray-400">尚未分配个人任务</p>}</div></section>}

      {tab === "提交与反馈" && <section className="space-y-4">{detail.submissions.map((submission) => { const evaluation = evaluationMap.get(submission.submission_id); return <article key={submission.submission_id} className="rounded-2xl border border-gray-200 bg-white p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h3 className="font-semibold text-gray-900">{submission.project_title}</h3><p className="mt-1 text-xs text-gray-500">提交于 {submission.submitted_at?.slice(0, 16).replace("T", " ") || "未知"} · {submission.submission_id}</p></div><Link href={`/teacher/reviews/${encodeURIComponent(submission.submission_id)}`} className="text-sm font-medium text-primary-600">查看完整证据与验收</Link></div><p className="mt-4 text-sm leading-6 text-gray-600">{submission.result_summary || submission.project_summary || "未填写成果摘要"}</p>{evaluation && <div className="mt-4 rounded-xl bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4" />带教终审 · {evaluation.score_total} 分</div><p className="mt-2 text-sm text-emerald-700">{evaluation.feedback}</p></div>}</article>; })}{!detail.submissions.length && <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center text-sm text-gray-400"><ClipboardList className="mx-auto mb-2 h-6 w-6" />暂无提交记录</div>}</section>}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div><dt className="text-xs font-medium text-gray-500">{label}</dt><dd className="mt-1 text-sm text-gray-900">{value || "未填写"}</dd></div>;
}

function CapabilityView({ capability, studentId }: { capability: Detail["capability"]; studentId: string }) {
  const assessment = capability.assessment;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary-700"><BrainCircuit className="h-4 w-4" />成长进度</div>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">{assessment.role_label}综合实力</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{assessment.summary}</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${assessment.evidence_confidence === "high" ? "bg-emerald-50 text-emerald-700" : assessment.evidence_confidence === "medium" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>证据可信度：{assessment.evidence_confidence === "high" ? "高" : assessment.evidence_confidence === "medium" ? "中" : "低"}</span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="综合实力" value={`${assessment.overall_score} 分`} hint={`${assessment.level} 等级`} />
          <Metric label="阶段目标" value={`${assessment.stage_target_score} 分`} hint={`达成率 ${assessment.attainment_rate}%`} progress={assessment.attainment_rate} />
          <Metric label="最近趋势" value={`${assessment.trend > 0 ? "+" : ""}${assessment.trend} 分`} hint={assessment.trend_label} />
          <Metric label="任务完成率" value={`${assessment.task_stats.completion_rate}%`} hint={`${assessment.task_stats.accepted_count}/${assessment.task_stats.assigned_count} 项通过`} progress={assessment.task_stats.completion_rate} />
          <Metric label="资料完整度" value={`${capability.profile_completeness}%`} hint="档案、专业、作品入口" progress={capability.profile_completeness} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">{capability.profile_signals.map((signal) => <span key={signal} className="rounded-full bg-primary-50 px-3 py-1.5 text-xs text-primary-800">{signal}</span>)}</div>
        <p className="mt-4 text-xs leading-5 text-gray-400">综合实力分按当前岗位权重计算；任务映射、提交和带教验收会持续沉淀为新的能力证据。</p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2"><Target className="h-5 w-5 text-primary-600" /><div><h2 className="font-semibold text-gray-900">能力画像</h2><p className="mt-1 text-xs text-gray-500">先看通用工作能力，再看当前岗位的加权能力。</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {assessment.generic_dimensions.map((dimension) => <AbilityBar key={dimension.id} dimension={dimension} />)}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary-600" /><div><h2 className="font-semibold text-gray-900">{assessment.role_label}岗位能力</h2><p className="mt-1 text-xs text-gray-500">综合实力 = 各岗位指标得分 × 岗位权重 × 20。</p></div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {assessment.role_dimensions.map((dimension) => <AbilityBar key={dimension.id} dimension={dimension} showWeight />)}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <InsightPanel title="主要优势" items={assessment.strengths} tone="emerald" />
        <InsightPanel title="主要短板" items={assessment.weaknesses} tone="amber" />
        <InsightPanel title="下一步建议" items={assessment.next_steps} tone="primary" />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary-600" /><h2 className="font-semibold text-gray-900">为什么是这个分数</h2></div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-600">{assessment.score_explanation.map((item) => <li key={item}>· {item}</li>)}</ul>
          <div className="mt-4 flex flex-wrap gap-2">{assessment.evidence.map((item) => <span key={item} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600">{item}</span>)}</div>
        </section>
        <section className="rounded-2xl border border-primary-100 bg-primary-50/40 p-6">
          <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary-600" /><h2 className="font-semibold text-gray-900">带教建议</h2></div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">{assessment.mentor_advice.map((item) => <li key={item}>· {item}</li>)}</ul>
          {assessment.risk_alerts.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="flex items-center gap-2 text-xs font-medium text-amber-800"><AlertTriangle className="h-4 w-4" />需要关注</p><ul className="mt-2 space-y-1 text-xs leading-5 text-amber-800">{assessment.risk_alerts.map((item) => <li key={item}>· {item}</li>)}</ul></div>}
        </section>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">推荐任务</h2><p className="mt-1 text-xs text-gray-500">推荐分仅供带教发布任务时参考，实习生端不可见。</p></div><Link href={`/management/tasks?studentId=${encodeURIComponent(studentId)}&create=1`} className="text-sm font-medium text-primary-700 hover:underline">发布个人任务</Link></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {capability.recommended_tasks.slice(0, 6).map((task) => <article key={task.category_id} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-900">{task.title}</p><p className="mt-1 text-xs text-gray-500">{task.allocation_label}</p></div><strong className="text-xl text-primary-700">{task.score}%</strong></div><p className="mt-3 text-xs leading-5 text-gray-600">{task.reasons[0]}</p>{task.gaps.length > 0 && <p className="mt-2 text-xs leading-5 text-amber-700">短板：{task.gaps.slice(0, 2).join("；")}</p>}<p className="mt-2 text-xs leading-5 text-gray-500">带教动作：{task.mentor_action}</p></article>)}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900">三个岗位评估模型示例</h2>
        <p className="mt-1 text-xs text-gray-500">当前实习生按实际岗位计算；以下示例用于确认三套岗位模型已经具备独立权重。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">{assessment.role_examples.map((example) => <div key={example.role} className="rounded-xl bg-gray-50 p-4"><div className="flex items-center justify-between"><p className="font-medium text-gray-900">{example.role_label}</p><span className="text-sm font-semibold text-primary-700">{example.overall_score} · {example.level}</span></div><ul className="mt-3 space-y-1 text-xs leading-5 text-gray-600">{example.highlights.map((item) => <li key={item}>· {item}</li>)}</ul></div>)}</div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2"><Target className="h-5 w-5 text-primary-600" /><div><h2 className="font-semibold text-gray-900">能力证据明细</h2><p className="mt-1 text-xs text-gray-500">把“做过”与“已被带教确认”分开显示。</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {capability.items.map((item) => <div key={item.competency_id} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-900">{item.name}</p><p className="mt-1 text-xs text-gray-500">{item.evidence_count ? `${item.evidence_count} 条相关证据` : "尚无相关证据"}</p></div><MaturityBadge maturity={item.maturity} /></div>{item.description && <p className="mt-3 text-xs leading-5 text-gray-500">{item.description}</p>}</div>)}
        </div>
      </section>

    </div>
  );
}

function Metric({ label, value, hint, progress }: { label: string; value: string; hint: string; progress?: number }) {
  return <div className="rounded-xl bg-gray-50 p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-gray-900">{value}</p><p className="mt-1 text-xs text-gray-500">{hint}</p>{progress !== undefined && <div className="mt-3"><ProgressBar value={progress} /></div>}</div>;
}

function AbilityBar({ dimension, showWeight = false }: { dimension: AssessmentDimension; showWeight?: boolean }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-gray-800">{dimension.label}</span><span className="text-sm font-semibold text-gray-900">{dimension.score}/5</span></div><div className="mt-3"><ProgressBar value={dimension.score * 20} tone={dimension.score >= 3.5 ? "bg-emerald-500" : dimension.score >= 2 ? "bg-amber-500" : "bg-gray-400"} /></div><div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-400"><span>{dimension.evidence_count ? `${dimension.evidence_count} 条证据` : "未体现"}</span>{showWeight && <span>权重 {Math.round((dimension.weight || 0) * 100)}%</span>}</div></div>;
}

function InsightPanel({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "amber" | "primary" }) {
  const className = tone === "emerald" ? "border-emerald-100 bg-emerald-50/40" : tone === "amber" ? "border-amber-100 bg-amber-50/40" : "border-primary-100 bg-primary-50/40";
  return <section className={`rounded-2xl border p-5 ${className}`}><h2 className="font-semibold text-gray-900">{title}</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">{items.map((item) => <li key={item}>· {item}</li>)}</ul></section>;
}

function MaturityBadge({ maturity }: { maturity: "verified" | "practiced" | "untouched" }) {
  const config = {
    verified: { label: "已验收", className: "bg-emerald-50 text-emerald-700" },
    practiced: { label: "做过", className: "bg-blue-50 text-blue-700" },
    untouched: { label: "待练习", className: "bg-gray-100 text-gray-600" },
  }[maturity];
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${config.className}`}>{config.label}</span>;
}
