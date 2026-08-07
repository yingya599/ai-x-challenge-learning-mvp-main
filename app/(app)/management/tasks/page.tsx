"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Filter,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  Target,
  UserRoundCheck,
  X,
} from "lucide-react";
import { ErrorState, LoadingState, TaskStatusBadge, directionLabels, riskLabels } from "@/components/management/ManagementUi";

type Task = { task_id: string; category_id: string; title: string; student_id: string; student_name: string; mentor_id: string; mentor_name: string; job_direction: string; status?: string; due_date?: string; computed_risk?: string };
type Intern = { student_id: string; name: string; mentor_id?: string; mentor_name?: string; department?: string; position?: string; job_direction: string };
type Category = { category_id: string; title: string; job_direction: string; summary?: string; competency_ids_json?: string; source_type?: string };
type Mentor = { mentorId: string; name: string };
type DraftEvidence = { type: string; label: string; required: boolean };
type TaskDraft = {
  title: string;
  business_context: string;
  objective: string;
  acceptance_criteria: string;
  priority: string;
  confidentiality: string;
  evidence_requirements: DraftEvidence[];
  clarification_questions: string[];
  assumptions: string[];
  mode: "model" | "demo";
};
type CapabilityItem = { competency_id: string; name: string; maturity: "verified" | "practiced" | "untouched"; evidence_count: number };
type Capability = { coverage: number; profile_completeness: number; target_count: number; practiced_count: number; verified_count: number; items: CapabilityItem[] };
type MatchResult = { score: number; fit: "high" | "medium" | "stretch"; reasons: string[]; gaps: string[]; matchedNames: string[] };

const revenueForecastExample = `项目背景：通信运营业务的主要 KPI 是年度收入，需要基于历史数据建立收入预测和预警管理逻辑，为常态化经营工作提供参考。
任务要求：先使用近 36 个月的流量收入数据，完成 2026 年后续月份的时间序列预测；比较多个候选模型并说明数据预处理、模型评估和选择依据。第二阶段分别预测流量单价、出账用户数、零流量用户数、户均流量，再合成收入并给出经营建议。
工具与产出：使用数据处理和预测建模工具，最终以 PPT 呈现收入预测分析报告。
注意：数据需要严格保密使用。`;

export default function PersonalTasksPage() {
  return <Suspense fallback={<LoadingState text="正在读取任务筛选条件..." />}><PersonalTasksContent /></Suspense>;
}

function PersonalTasksContent() {
  const params = useSearchParams();
  const initialStudentId = params.get("studentId") || "";
  const initialCategoryId = params.get("categoryId") || "";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [interns, setInterns] = useState<Intern[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [role, setRole] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(params.get("status") || "all");
  const [risk, setRisk] = useState(params.get("risk") || "all");
  const [studentId, setStudentId] = useState(initialStudentId || "all");
  const [showCreate, setShowCreate] = useState(params.get("create") === "1");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [taskResponse, internResponse, categoryResponse, userResponse, overviewResponse] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/management/interns"),
        fetch("/api/task-categories"),
        fetch("/api/auth/me"),
        fetch("/api/management/overview"),
      ]);
      const [taskPayload, internPayload, categoryPayload, userPayload, overviewPayload] = await Promise.all([
        taskResponse.json(), internResponse.json(), categoryResponse.json(), userResponse.json(), overviewResponse.json(),
      ]);
      if (!taskResponse.ok) throw new Error(taskPayload.error || "任务加载失败");
      if (!internResponse.ok) throw new Error(internPayload.error || "实习生加载失败");
      if (!categoryResponse.ok) throw new Error(categoryPayload.error || "任务类别加载失败");
      setTasks(taskPayload.tasks || []);
      setStorageReady(taskPayload.storage_ready === true);
      setInterns(internPayload.interns || []);
      setCategories((categoryPayload.categories || []).filter((item: Category) => item.source_type !== "historical_challenge"));
      setRole(userPayload.role || "");
      setMentors((overviewPayload.overview?.mentorWorkload || []).map((item: Mentor) => ({ mentorId: item.mentorId, name: item.name })));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => tasks.filter((task) => {
    const active = !["accepted", "cancelled"].includes(task.status || "");
    return (!search || `${task.title} ${task.student_name} ${task.mentor_name}`.toLowerCase().includes(search.toLowerCase()))
      && (studentId === "all" || task.student_id === studentId)
      && (status === "all" || (status === "active" ? active : task.status === status))
      && (risk === "all" || (risk === "risk" ? task.computed_risk !== "normal" : task.computed_risk === risk));
  }), [tasks, search, studentId, status, risk]);

  if (error) return <ErrorState message={error} />;
  if (loading) return <LoadingState text="正在加载个人任务..." />;
  const canCreate = ["teacher", "mentor", "leader"].includes(role);

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-medium text-primary-600">任务视图</p><h1 className="mt-1 text-2xl font-bold text-gray-900">个人任务</h1><p className="mt-1 text-sm text-gray-500">每项任务都明确分配给一名实习生，并记录负责带教、期限和验收要求。</p></div>
      {canCreate && <button onClick={() => setShowCreate(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" />发布个人任务</button>}
    </div>
    {!storageReady && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><p className="font-medium">个人任务表尚未连接飞书</p><p className="mt-1 text-xs leading-5">当前只能查看历史数据，不能发布新任务。完成 Tasks 表创建并配置后，发布功能会自动启用。</p></div>}
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 xl:flex-row">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索任务、实习生或带教..." className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm" /></div>
      <div className="flex flex-wrap items-center gap-2"><Filter className="h-4 w-4 text-gray-400" /><select value={studentId} onChange={(event) => setStudentId(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="all">全部实习生</option>{interns.map((item) => <option key={item.student_id} value={item.student_id}>{item.name}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="all">全部状态</option><option value="active">进行中</option><option value="submitted">待验收</option><option value="returned">已退回</option><option value="accepted">已通过</option></select><select value={risk} onChange={(event) => setRisk(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="all">全部风险</option><option value="risk">仅看风险</option><option value="overdue">已逾期</option><option value="due_soon">即将到期</option></select></div>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white"><table className="w-full min-w-[960px] text-sm"><thead className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500"><tr><th className="px-5 py-3">个人任务</th><th className="px-5 py-3">实习生</th><th className="px-5 py-3">岗位</th><th className="px-5 py-3">带教</th><th className="px-5 py-3">截止日期</th><th className="px-5 py-3">状态</th><th className="px-5 py-3">风险</th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map((task) => <tr key={task.task_id} className="hover:bg-gray-50"><td className="px-5 py-4"><Link href={`/management/tasks/${encodeURIComponent(task.task_id)}`} className="font-medium text-primary-700 hover:underline">{task.title}</Link><p className="mt-1 font-mono text-xs text-gray-400">{task.task_id}</p></td><td className="px-5 py-4"><Link href={`/management/interns/${encodeURIComponent(task.student_id)}`} className="text-gray-800 hover:text-primary-700">{task.student_name}</Link></td><td className="px-5 py-4">{directionLabels[task.job_direction] || task.job_direction}</td><td className="px-5 py-4">{task.mentor_name}</td><td className="px-5 py-4">{task.due_date?.slice(0, 10) || "未设置"}</td><td className="px-5 py-4"><TaskStatusBadge status={task.status} /></td><td className="px-5 py-4"><span className={task.computed_risk === "normal" ? "text-emerald-600" : "font-medium text-rose-600"}>{riskLabels[task.computed_risk || ""] || task.computed_risk}</span></td></tr>)}</tbody></table>{!filtered.length && <div className="py-12 text-center text-sm text-gray-400">暂无符合条件的个人任务</div>}</div>
    {showCreate && canCreate && <CreateTaskModal role={role} storageReady={storageReady} interns={interns} mentors={mentors} categories={categories} initialStudentId={initialStudentId} initialCategoryId={initialCategoryId} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load(); }} />}
  </div>;
}

function CreateTaskModal({ role, storageReady, interns, mentors, categories, initialStudentId, initialCategoryId, onClose, onCreated }: { role: string; storageReady: boolean; interns: Intern[]; mentors: Mentor[]; categories: Category[]; initialStudentId?: string; initialCategoryId?: string; onClose: () => void; onCreated: () => void }) {
  const isLeader = role === "leader";
  const canViewMatch = role === "teacher" || role === "mentor";
  const initialIntern = interns.find((item) => item.student_id === initialStudentId);
  const initialCategory = categories.find((item) => item.category_id === initialCategoryId);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState(() => ({
    student_id: initialIntern?.student_id || "",
    mentor_id: initialIntern?.mentor_id || "",
    category_id: initialCategory?.category_id || (initialIntern ? `custom-${initialIntern.job_direction}` : ""),
    job_direction: initialIntern?.job_direction || initialCategory?.job_direction || "data_analysis",
    title: initialCategory?.title || "",
    business_context: "",
    objective: "",
    acceptance_criteria: "",
    due_date: "",
    priority: "medium",
    confidentiality: "internal",
  }));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [rawBrief, setRawBrief] = useState("");
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [allowExternalAi, setAllowExternalAi] = useState(false);
  const [capability, setCapability] = useState<Capability | null>(null);
  const [capabilityLoading, setCapabilityLoading] = useState(false);
  const [evidenceRequirements, setEvidenceRequirements] = useState<DraftEvidence[]>([{ type: "document", label: "成果文档", required: true }]);
  const selectedIntern = interns.find((item) => item.student_id === form.student_id);
  const selectedCategory = categories.find((item) => item.category_id === form.category_id);
  const selectedExistingCategory = selectedCategory && !form.category_id.startsWith("custom-") ? selectedCategory : null;
  const availableCategories = useMemo(() => {
    if (!selectedIntern) return [];
    const unique = new Map<string, Category>();
    for (const category of categories.filter((item) => item.job_direction === selectedIntern.job_direction)) {
      unique.set(category.title, category);
    }
    return Array.from(unique.values()).slice(0, 8);
  }, [categories, selectedIntern]);
  const existingTaskMatch = canViewMatch && selectedExistingCategory && capability
    ? matchTaskToCapability(capability, competencyIdsForCategory(selectedExistingCategory), `${selectedExistingCategory.title}\n${selectedExistingCategory.summary || ""}`)
    : null;
  const customCompetencyIds = useMemo(() => inferCompetencyIds(form.job_direction, `${form.title}\n${rawBrief}\n${form.objective}\n${form.acceptance_criteria}`), [form.job_direction, form.title, rawBrief, form.objective, form.acceptance_criteria]);
  const customTaskMatch = canViewMatch && capability && rawBrief.trim().length >= 10
    ? matchTaskToCapability(capability, customCompetencyIds, rawBrief)
    : null;
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!canViewMatch || !form.student_id) {
      setCapability(null);
      return;
    }
    setCapabilityLoading(true);
    fetch(`/api/management/interns/${encodeURIComponent(form.student_id)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || "能力画像加载失败");
        setCapability(payload.detail.capability);
      })
      .catch(() => setCapability(null))
      .finally(() => setCapabilityLoading(false));
  }, [canViewMatch, form.student_id]);

  const next = () => {
    if (!form.student_id) { setMessage("请先选择这项任务要分配给哪名实习生"); return; }
    if (isLeader && !form.mentor_id) { setMessage("请为这名实习生指定负责带教"); return; }
    setMessage(""); setStep(2);
  };

  const organizeWithAi = async () => {
    if (rawBrief.trim().length < 10) { setMessage("请先用自然语言描述任务，至少填写 10 个字"); return; }
    setDrafting(true); setMessage("");
    const categoryTitle = selectedExistingCategory?.title;
    const response = await fetch("/api/ai/task-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: rawBrief, category_title: categoryTitle, job_direction: form.job_direction, allow_external_ai: allowExternalAi }),
    });
    const payload = await response.json();
    setDrafting(false);
    if (!response.ok) { setMessage(payload.error || "AI 整理失败"); return; }
    const nextDraft = payload.draft as TaskDraft;
    setDraft(nextDraft);
    setEvidenceRequirements(nextDraft.evidence_requirements || []);
    setForm((current) => ({
      ...current,
      title: nextDraft.title,
      business_context: nextDraft.business_context,
      objective: nextDraft.objective,
      acceptance_criteria: nextDraft.acceptance_criteria,
      priority: nextDraft.priority,
      confidentiality: nextDraft.confidentiality,
    }));
    setMessage(nextDraft.mode === "demo" ? "草稿已生成：当前为本地演示模式，内容未发送到外部 AI。" : "AI 草稿已生成，请确认后再发布。");
  };

  const chooseIntern = (internId: string) => {
    const intern = interns.find((item) => item.student_id === internId);
    setForm((current) => {
      const currentCategory = categories.find((item) => item.category_id === current.category_id);
      const categoryToKeep = intern && currentCategory?.job_direction === intern.job_direction ? currentCategory : undefined;
      return {
        ...current,
        student_id: internId,
        mentor_id: intern?.mentor_id || "",
        job_direction: intern?.job_direction || current.job_direction,
        category_id: categoryToKeep?.category_id || (intern ? `custom-${intern.job_direction}` : ""),
        title: categoryToKeep?.title || "",
      };
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!storageReady) { setMessage("个人任务表尚未连接飞书，暂时不能发布任务"); return; }
    if (!form.student_id) { setMessage("请先选择这项任务要分配给哪名实习生"); return; }
    if (isLeader && !form.mentor_id) { setMessage("领导发布任务时必须指定负责带教"); return; }
    setSaving(true); setMessage("");
    const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ...form,
      competency_ids_json: selectedExistingCategory?.competency_ids_json || JSON.stringify(customCompetencyIds),
      raw_task_brief: rawBrief,
      ai_clarification_questions_json: JSON.stringify(draft?.clarification_questions || []),
      ai_generation_mode: draft?.mode || "",
      ai_updated_at: draft ? new Date().toISOString() : "",
      evidence_requirements: evidenceRequirements,
    }) });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(payload.error || "创建失败"); return; }
    onCreated();
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
    <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-gray-900">发布个人任务</h2><p className="mt-1 text-sm text-gray-500">第 {step} 步，共 2 步 · {step === 1 ? "选择实习生和已有任务" : "填写真实业务任务要求"}</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
    <div className="mt-5 grid grid-cols-2 gap-3"><div className={`rounded-lg border px-3 py-2 text-sm ${step === 1 ? "border-primary-300 bg-primary-50 font-medium text-primary-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>1. 实习生与任务来源</div><div className={`rounded-lg border px-3 py-2 text-sm ${step === 2 ? "border-primary-300 bg-primary-50 font-medium text-primary-800" : "border-gray-200 text-gray-400"}`}>2. 内容与匹配确认</div></div>
    {!storageReady && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">尚未配置飞书 Tasks 表。你可以查看表单结构，但配置完成前不会允许发布。</div>}
    {step === 1 && <section className="mt-5 rounded-xl border border-primary-200 bg-primary-50/50 p-4">
      <div className="flex items-center gap-2 font-medium text-primary-900"><UserRoundCheck className="h-5 w-5" />先确定任务分给谁</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="让哪名实习生执行？ *"><select value={form.student_id} onChange={(event) => chooseIntern(event.target.value)} className="input"><option value="">请选择实习生</option>{interns.map((item) => <option key={item.student_id} value={item.student_id}>{item.name} · {item.position || directionLabels[item.job_direction]}</option>)}</select></Field>
        {isLeader ? <Field label="负责带教 *"><select value={form.mentor_id} onChange={(event) => update("mentor_id", event.target.value)} className="input"><option value="">请选择带教</option>{mentors.map((item) => <option key={item.mentorId} value={item.mentorId}>{item.name}</option>)}</select></Field> : <div className="rounded-lg bg-white p-3 text-sm text-gray-600"><p className="text-xs text-gray-400">负责带教</p><p className="mt-1 font-medium text-gray-800">当前带教账号（自动绑定）</p></div>}
      </div>
      {selectedIntern && <div className="mt-4">
        <p className="mb-2 text-xs text-primary-800">{selectedIntern.name} · {selectedIntern.department || "未填写部门"} · {directionLabels[selectedIntern.job_direction] || selectedIntern.position}</p>
        <Field label="从已有任务列表选择（可选）"><select value={form.category_id} onChange={(event) => { const category = availableCategories.find((item) => item.category_id === event.target.value); setForm((current) => ({ ...current, category_id: event.target.value, job_direction: category?.job_direction || current.job_direction, title: category?.title || "" })); }} className="input"><option value={`custom-${selectedIntern.job_direction}`}>没有合适任务，我要新建任务</option>{availableCategories.map((item) => <option key={item.category_id} value={item.category_id}>{item.title}</option>)}</select></Field>
        <p className="mt-2 text-xs leading-5 text-gray-500">选已有任务时先看匹配度再继续；没有合适任务就选择新建，下一步写完描述后再看匹配度。</p>
        {canViewMatch && capabilityLoading && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-gray-500">正在读取该实习生的成长进度与能力证据...</p>}
        {canViewMatch && existingTaskMatch && <MatchCard title="已有任务与实习生匹配度" match={existingTaskMatch} />}
      </div>}
    </section>}
    {step === 2 && <>
      <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"><span className="font-medium">{selectedIntern?.name}</span> · {directionLabels[form.job_direction]} · {selectedExistingCategory?.title || "新建任务"}</div>
      <section className="mt-5 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="flex items-center gap-2 font-semibold text-primary-900"><Bot className="h-5 w-5" />让 AI 帮你整理任务</div><p className="mt-1 text-xs leading-5 text-gray-600">直接描述任务即可，不必按固定模板。AI 只生成草稿，发布前仍由带教确认。</p></div>
          <button type="button" onClick={() => setRawBrief(revenueForecastExample)} className="shrink-0 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-medium text-primary-700">载入收入预测示例</button>
        </div>
        <textarea value={rawBrief} onChange={(event) => setRawBrief(event.target.value)} rows={7} placeholder="例如：请基于近三年的月度收入数据预测明年收入，先做直接时间序列预测，再分析几个关键经营驱动，最后交一份 PPT。数据保密……" className="mt-4 w-full rounded-xl border border-primary-200 bg-white p-3 text-sm leading-6 outline-none focus:border-primary-400" />
        {canViewMatch && !selectedExistingCategory && rawBrief.trim().length < 10 && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-gray-500">写完新任务描述后，这里会显示任务与该实习生的匹配度。</p>}
        {canViewMatch && !selectedExistingCategory && customTaskMatch && <MatchCard title="新建任务与实习生匹配度" match={customTaskMatch} />}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-start gap-2 text-xs text-gray-600"><input type="checkbox" checked={allowExternalAi} onChange={(event) => setAllowExternalAi(event.target.checked)} className="mt-0.5" /><span>允许把这段描述发送给已配置的外部 AI。保密任务建议保持关闭。</span></label>
          <button type="button" onClick={() => void organizeWithAi()} disabled={drafting} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{drafting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{drafting ? "正在整理..." : "AI 整理为任务草稿"}</button>
        </div>
        {draft && <div className="mt-4 rounded-xl border border-primary-100 bg-white p-4"><div className="flex items-center justify-between"><p className="text-sm font-medium text-gray-900">AI 建议先向带教确认</p><span className={`rounded-full px-2 py-1 text-[11px] ${draft.mode === "demo" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{draft.mode === "demo" ? "本地演示模式" : "AI 模型生成"}</span></div><ul className="mt-2 space-y-1 text-xs leading-5 text-gray-600">{draft.clarification_questions.map((item) => <li key={item}>• {item}</li>)}</ul></div>}
      </section>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="截止日期 *"><input required type="date" value={form.due_date} onChange={(event) => update("due_date", event.target.value)} className="input" /></Field><Field label="优先级"><select value={form.priority} onChange={(event) => update("priority", event.target.value)} className="input"><option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="urgent">紧急</option></select></Field><Field label="真实任务标题 *" wide><input required value={form.title} onChange={(event) => update("title", event.target.value)} className="input" /></Field><Field label="业务背景" wide><textarea value={form.business_context} onChange={(event) => update("business_context", event.target.value)} rows={3} className="input resize-y" /></Field><Field label="目标与要求" wide><textarea value={form.objective} onChange={(event) => update("objective", event.target.value)} rows={4} className="input resize-y" /></Field><Field label="验收标准" wide><textarea value={form.acceptance_criteria} onChange={(event) => update("acceptance_criteria", event.target.value)} rows={5} className="input resize-y" /></Field><Field label="保密等级"><select value={form.confidentiality} onChange={(event) => update("confidentiality", event.target.value)} className="input"><option value="internal">内部</option><option value="confidential">保密</option><option value="restricted">严格保密</option></select></Field></div>
    </>}
    {message && <p className={`mt-4 rounded-lg p-3 text-sm ${message.startsWith("草稿已生成") || message.startsWith("AI 草稿") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</p>}
    <div className="mt-6 flex justify-between gap-3"><button type="button" onClick={step === 1 ? onClose : () => setStep(1)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2 text-sm">{step === 2 && <ChevronLeft className="h-4 w-4" />}{step === 1 ? "取消" : "上一步"}</button>{step === 1 ? <button type="button" onClick={next} disabled={!interns.length} className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">下一步<ChevronRight className="h-4 w-4" /></button> : <button disabled={saving || !storageReady} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{!storageReady ? "请先连接飞书任务表" : saving ? "发布中..." : "发布并分配"}</button>}</div>
  </form></div>;
}

function MatchCard({ title, match }: { title: string; match: MatchResult }) {
  const fitText = match.fit === "high" ? "高匹配" : match.fit === "medium" ? "中匹配" : "成长型任务";
  return <div className="mt-3 rounded-xl border border-emerald-100 bg-white p-4">
    <div className="flex items-start justify-between gap-4">
      <div><div className="flex items-center gap-2 font-medium text-gray-900"><Target className="h-4 w-4 text-emerald-600" />{title}</div><p className="mt-1 text-xs text-gray-500">仅带教可见，用作发布前参考。</p></div>
      <div className="text-right"><p className="text-2xl font-bold text-emerald-700">{match.score}%</p><p className="text-xs text-emerald-700">{fitText}</p></div>
    </div>
    <ul className="mt-3 space-y-1 text-xs leading-5 text-gray-600">{match.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
    {match.gaps.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">可借这个任务补齐：{match.gaps.slice(0, 3).join("、")}</p>}
  </div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>{children}</label>;
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

function competencyIdsForCategory(category: Category) {
  const parsed = parseJsonArray(category.competency_ids_json);
  if (parsed.length) return parsed;
  return inferCompetencyIds(category.job_direction, category.title);
}

function inferCompetencyIds(direction: string, text: string) {
  const source = text.toLowerCase();
  const ids = new Set(["common-problem-definition", "common-delivery"]);
  if (source.includes("沟通") || source.includes("汇报") || source.includes("ppt") || source.includes("报告")) ids.add("common-communication");
  if (source.includes("复盘") || source.includes("迭代") || source.includes("改进")) ids.add("common-reflection");
  if (direction === "business_analysis") {
    if (source.includes("预测") || source.includes("收入") || source.includes("forecast")) ids.add("ba-forecast");
    if (source.includes("诊断") || source.includes("原因") || source.includes("经营") || source.includes("问题")) ids.add("ba-diagnosis");
    if (source.includes("市场") || source.includes("竞品")) ids.add("ba-market");
    if (source.includes("建议") || source.includes("汇报") || source.includes("ppt")) ids.add("ba-storytelling");
  } else if (direction === "quant") {
    if (source.includes("数据") || source.includes("行情")) ids.add("quant-data");
    if (source.includes("因子")) ids.add("quant-factor");
    if (source.includes("回测") || source.includes("策略")) ids.add("quant-backtest");
    if (source.includes("风险") || source.includes("收益") || source.includes("组合")) ids.add("quant-risk");
  } else {
    if (source.includes("清洗") || source.includes("质量") || source.includes("口径") || source.includes("预处理") || source.includes("异常值")) ids.add("da-quality");
    if (source.includes("指标") || source.includes("口径") || source.includes("kpi") || source.includes("收入") || source.includes("流量") || source.includes("留存") || source.includes("转化")) ids.add("da-metrics");
    if (source.includes("分析") || source.includes("实验") || source.includes("效果") || source.includes("预测") || source.includes("分类") || source.includes("模型") || source.includes("时间序列") || source.includes("arima") || source.includes("prophet")) ids.add("da-analysis");
    if (source.includes("看板") || source.includes("自动化") || source.includes("dashboard") || source.includes("可视化") || source.includes("报表")) ids.add("da-automation");
  }
  return Array.from(ids);
}

function matchTaskToCapability(capability: Capability, competencyIds: string[], text: string): MatchResult {
  const itemMap = new Map(capability.items.map((item) => [item.competency_id, item]));
  const matchedItems = competencyIds.map((id) => itemMap.get(id)).filter(Boolean) as CapabilityItem[];
  const maturityScore: Record<CapabilityItem["maturity"], number> = { verified: 96, practiced: 76, untouched: 46 };
  const readiness = matchedItems.length
    ? matchedItems.reduce((sum, item) => sum + maturityScore[item.maturity], 0) / matchedItems.length
    : 50;
  const evidenceBonus = Math.min(10, matchedItems.reduce((sum, item) => sum + item.evidence_count, 0) * 2);
  const targetCoverageBonus = competencyIds.length ? Math.round((matchedItems.length / competencyIds.length) * 6) : 0;
  const scopeAdjustment = competencyIds.length <= 2 ? 5 : competencyIds.length >= 5 ? -7 : competencyIds.length === 4 ? -3 : 0;
  const source = text.toLowerCase();
  const advancedSignals = ["模型", "时间序列", "预测", "回测", "算法", "自动化", "异常", "置信区间", "mape", "rmse", "arima", "prophet"];
  const deliverySignals = ["ppt", "报告", "可视化", "看板", "复盘", "文档", "汇报"];
  const complexityPenalty = Math.min(10, advancedSignals.filter((keyword) => source.includes(keyword)).length * 2);
  const deliveryBonus = Math.min(6, deliverySignals.filter((keyword) => source.includes(keyword)).length * 2);
  const score = Math.min(98, Math.max(42, Math.round(
    42
    + readiness * 0.32
    + capability.profile_completeness * 0.11
    + capability.coverage * 0.12
    + evidenceBonus
    + targetCoverageBonus
    + scopeAdjustment
    + deliveryBonus
    - complexityPenalty,
  )));
  const verified = matchedItems.filter((item) => item.maturity === "verified");
  const practiced = matchedItems.filter((item) => item.maturity === "practiced");
  const gaps = matchedItems.filter((item) => item.maturity === "untouched").map((item) => item.name);
  const reasons = ["岗位方向一致"];
  reasons.push(`覆盖 ${matchedItems.length || competencyIds.length} 项能力要求`);
  if (verified.length) reasons.push(`${verified.length} 项相关能力已通过验收`);
  if (practiced.length) reasons.push(`${practiced.length} 项相关能力已有练习记录`);
  if (!verified.length && !practiced.length) reasons.push("该任务更适合作为新的成长任务");
  return {
    score,
    fit: score >= 84 ? "high" : score >= 68 ? "medium" : "stretch",
    reasons,
    gaps,
    matchedNames: matchedItems.map((item) => item.name),
  };
}
