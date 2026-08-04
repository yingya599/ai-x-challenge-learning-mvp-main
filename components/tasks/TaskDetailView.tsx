"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, CircleCheck, ExternalLink, FileText, LoaderCircle, Paperclip, Plus, Send, Sparkles, Trash2, Upload } from "lucide-react";
import { ErrorState, LoadingState, TaskStatusBadge, directionLabels, riskLabels } from "@/components/management/ManagementUi";
import { formatTime } from "@/lib/format";

type EvidenceType = "document" | "spreadsheet" | "presentation" | "dashboard" | "github" | "demo" | "other";
type Evidence = { type: EvidenceType; label: string; url: string; note?: string };
type UploadedFile = { file_token: string; name: string; size: number; type: string; evidence_type: EvidenceType };
type Requirement = { type: EvidenceType; label: string; required: boolean };
type Task = { task_id: string; category_id: string; title: string; student_id: string; student_name?: string; mentor_name?: string; job_direction: string; business_context?: string; objective?: string; instructions_md?: string; acceptance_criteria?: string; evidence_requirements_json?: string; competency_ids_json?: string; start_date?: string; due_date?: string; priority?: string; confidentiality?: string; status?: string; computed_risk?: string; recordId?: string; ai_plan_json?: string; ai_generation_mode?: "model" | "demo"; ai_updated_at?: string };
type Submission = { submission_id: string; task_id?: string; student_id: string; challenge_id: string; project_title: string; project_summary?: string; result_summary?: string; evidence_items_json?: string; github_repo_url?: string; submitted_at?: string; status?: string; attachment_files?: UploadedFile[] };
type TaskPlan = { summary: string; steps: Array<{ title: string; purpose: string; actions: string[]; deliverable: string; mentor_checkpoint?: string }>; clarification_questions: string[]; risks: string[]; pre_submit_checklist: string[]; mode: "model" | "demo"; generated_at: string };
type AiReview = { scoreTotal: number; scores: Record<string, number>; strengths: string; weaknesses: string; suggestions: string; feedback: string; fallback?: boolean };

const evidenceLabels: Record<EvidenceType, string> = { document: "在线报告/飞书文档", spreadsheet: "Excel/在线表格", presentation: "PPT/在线演示", dashboard: "数据看板", github: "GitHub 代码仓库", demo: "Demo/业务系统", other: "其他材料" };

export default function TaskDetailView({ taskId, management }: { taskId: string; management: boolean }) {
  const [task, setTask] = useState<Task | null>(null); const [submissions, setSubmissions] = useState<Submission[]>([]); const [error, setError] = useState("");
  const load = () => Promise.all([fetch(`/api/tasks/${encodeURIComponent(taskId)}`), fetch("/api/submissions")]).then(async ([taskResponse, submissionResponse]) => {
    const [taskPayload, submissionPayload] = await Promise.all([taskResponse.json(), submissionResponse.json()]);
    if (!taskResponse.ok || !taskPayload.ok) throw new Error(taskPayload.error || "任务加载失败");
    const loadedTask = taskPayload.task as Task;
    setTask(loadedTask);
    setSubmissions((submissionPayload.submissions || []).filter((item: Submission) =>
      item.task_id === taskId || (taskId.startsWith("history-") && item.student_id === loadedTask.student_id && item.challenge_id === loadedTask.category_id)
    ));
  }).catch((reason) => setError(reason instanceof Error ? reason.message : "加载失败"));
  useEffect(() => { void load(); }, [taskId]);
  const requirements = useMemo(() => { try { const parsed = JSON.parse(task?.evidence_requirements_json || "[]"); return Array.isArray(parsed) ? parsed as Requirement[] : []; } catch { return []; } }, [task]);
  if (error) return <ErrorState message={error} />; if (!task) return <LoadingState text="正在加载任务说明与交付记录..." />;
  // 页面路由已经完成角色隔离：/tasks 是实习生视图，/management/tasks 是管理视图。
  // 不再额外请求一次身份接口，避免身份请求失败时把实习生操作区错误隐藏。
  const isIntern = !management;
  return <div className="space-y-6"><Link href={management ? "/management/tasks" : "/tasks"} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft className="h-4 w-4" />返回{management ? "个人任务" : "我的任务"}</Link>
    <header className="rounded-2xl border border-gray-200 bg-white p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">{directionLabels[task.job_direction] || task.job_direction}</span><TaskStatusBadge status={task.status} />{task.computed_risk && task.computed_risk !== "normal" && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700">{riskLabels[task.computed_risk]}</span>}</div><h1 className="mt-3 text-2xl font-bold text-gray-900">{task.title}</h1><p className="mt-2 text-sm text-gray-500">任务编号 {task.task_id}</p></div><div className="grid grid-cols-2 gap-2 text-sm"><Meta label="实习生" value={task.student_name || task.student_id} /><Meta label="带教" value={task.mentor_name || "未分配"} /><Meta label="截止日期" value={task.due_date?.slice(0, 10) || "未设置"} /><Meta label="保密等级" value={task.confidentiality === "restricted" ? "严格保密" : task.confidentiality === "confidential" ? "保密" : "内部"} /></div></div></header>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><main className="space-y-5">{isIntern && <AiTaskPlanCard task={task} />}<Section title="业务背景" text={task.business_context} /><Section title="目标与要求" text={task.instructions_md || task.objective} /><Section title="验收标准" text={task.acceptance_criteria} /><section className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="font-semibold text-gray-900">必交成果与证据</h2>{requirements.length ? <ul className="mt-4 space-y-2">{requirements.map((item, index) => <li key={`${item.type}-${index}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"><span>{item.label || evidenceLabels[item.type]}</span><span className={item.required ? "text-rose-600" : "text-gray-400"}>{item.required ? "必交" : "选交"}</span></li>)}</ul> : <p className="mt-3 text-sm text-gray-500">尚未配置结构化交付要求，以任务说明和验收标准为准。</p>}</section>
      <section className="rounded-2xl border border-gray-200 bg-white"><div className="border-b border-gray-100 px-6 py-4"><h2 className="font-semibold text-gray-900">提交版本与反馈</h2></div><div className="divide-y divide-gray-100">{submissions.map((submission) => <SubmissionCard key={submission.submission_id} submission={submission} />)}{!submissions.length && <div className="py-12 text-center text-sm text-gray-400">暂无提交版本</div>}</div></section></main>
      <aside>{isIntern && !["accepted", "cancelled"].includes(task.status || "") ? <SubmitTaskCard task={task} requirements={requirements} onSubmitted={load} /> : <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white p-5"><h2 className="font-semibold text-gray-900">任务操作</h2><p className="mt-2 text-sm leading-6 text-gray-500">{management ? "在这里查看任务要求和全部提交版本。待验收记录请进入验收详情完成终审。" : "任务已结束或当前无需提交。"}</p>{management && submissions[0] && <Link href={`/teacher/reviews/${encodeURIComponent(submissions[0].submission_id)}`} className="mt-4 block rounded-lg bg-primary-600 px-4 py-2.5 text-center text-sm font-medium text-white">进入验收详情</Link>}</div>}</aside></div>
  </div>;
}

function Section({ title, text }: { title: string; text?: string }) { return <section className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="font-semibold text-gray-900">{title}</h2><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-700">{text || "暂未填写"}</div></section>; }
function Meta({ label, value }: { label: string; value: string }) { return <div className="min-w-32 rounded-lg bg-gray-50 px-3 py-2"><p className="text-[11px] text-gray-400">{label}</p><p className="mt-0.5 font-medium text-gray-800">{value}</p></div>; }

function AiTaskPlanCard({ task }: { task: Task }) {
  const [plan, setPlan] = useState<TaskPlan | null>(() => { try { return task.ai_plan_json ? JSON.parse(task.ai_plan_json) as TaskPlan : null; } catch { return null; } });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [allowExternalAi, setAllowExternalAi] = useState(false);
  useEffect(() => { try { setPlan(task.ai_plan_json ? JSON.parse(task.ai_plan_json) as TaskPlan : null); } catch { setPlan(null); } }, [task.ai_plan_json]);
  const generate = async () => {
    setLoading(true); setMessage("");
    const response = await fetch(`/api/tasks/${encodeURIComponent(task.task_id)}/ai-plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allow_external_ai: allowExternalAi }) });
    const payload = await response.json(); setLoading(false);
    if (!response.ok) { setMessage(payload.error || "任务拆解失败"); return; }
    setPlan(payload.plan); setMessage(payload.plan.mode === "demo" ? "已生成并保存到飞书：当前为本地演示模式。" : "AI 拆解已生成并保存到飞书，刷新后仍可查看。");
  };
  return <section className="overflow-hidden rounded-2xl border border-primary-200 bg-white">
    <div className="bg-gradient-to-r from-primary-50 to-white px-6 py-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 font-semibold text-primary-900"><Bot className="h-5 w-5" />AI 任务助手</div><p className="mt-1 text-sm leading-6 text-gray-600">先帮你把任务拆成可执行步骤、带教检查点和提交前清单。它不会替你完成分析。</p><label className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-600"><input type="checkbox" checked={allowExternalAi} onChange={(event) => setAllowExternalAi(event.target.checked)} className="mt-1" /><span>允许将任务说明发送给 DeepSeek 生成拆解；不勾选时使用本地演示方案。</span></label></div><button type="button" onClick={() => void generate()} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{plan ? "重新生成拆解" : "AI 帮我拆解任务"}</button></div>{message && <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${message.startsWith("已生成") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</p>}</div>
    {plan ? <div className="space-y-5 p-6"><div className="flex items-center justify-between gap-3"><p className="text-sm leading-6 text-gray-700">{plan.summary}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${plan.mode === "demo" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{plan.mode === "demo" ? "本地演示模式" : "AI 模型生成"}</span></div><ol className="space-y-4">{plan.steps.map((step, index) => <li key={`${step.title}-${index}`} className="relative rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">{index + 1}</span><div className="min-w-0"><h3 className="font-medium text-gray-900">{step.title}</h3><p className="mt-1 text-xs text-gray-500">{step.purpose}</p><ul className="mt-3 space-y-1 text-sm leading-6 text-gray-700">{step.actions.map((action) => <li key={action}>• {action}</li>)}</ul><p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-gray-600"><span className="font-medium text-gray-800">阶段产物：</span>{step.deliverable}</p>{step.mentor_checkpoint && <p className="mt-2 text-xs font-medium text-primary-700">带教检查点：{step.mentor_checkpoint}</p>}</div></div></li>)}</ol><div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4"><div className="flex items-center gap-2 text-sm font-medium text-emerald-900"><CircleCheck className="h-4 w-4" />提交前检查</div><ul className="mt-2 space-y-1 text-xs leading-5 text-emerald-800">{plan.pre_submit_checklist.map((item) => <li key={item}>□ {item}</li>)}</ul></div></div> : <div className="px-6 py-7 text-sm text-gray-500">还没有生成个人任务拆解。点击上方按钮即可开始；生成结果会保存到独立飞书测试库，刷新后仍可查看。</div>}
  </section>;
}
function SubmissionCard({ submission }: { submission: Submission }) { let evidence: Evidence[] = []; try { evidence = JSON.parse(submission.evidence_items_json || "[]"); } catch {} return <article className="px-6 py-5"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-900">{submission.project_title}</p><p className="mt-1 text-xs text-gray-400">{formatTime(submission.submitted_at)}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">{submission.status || "待验收"}</span></div><p className="mt-3 text-sm leading-6 text-gray-600">{submission.result_summary || submission.project_summary || "未填写摘要"}</p><div className="mt-3 flex flex-wrap gap-2">{(submission.attachment_files || []).map((item) => <a key={item.file_token} href={`/api/submissions/${encodeURIComponent(submission.submission_id)}/attachments/${encodeURIComponent(item.file_token)}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-primary-700"><Paperclip className="h-3 w-3" />{item.name}</a>)}{evidence.map((item, index) => <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-primary-700"><FileText className="h-3 w-3" />{item.label}<ExternalLink className="h-3 w-3" /></a>)}{!evidence.length && submission.github_repo_url && <a href={submission.github_repo_url} target="_blank" rel="noreferrer" className="text-xs text-primary-700">GitHub 证据</a>}<Link href={`/submissions/${encodeURIComponent(submission.submission_id)}`} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1.5 text-xs font-medium text-primary-700">查看提交与 AI 初评</Link></div></article>; }

function SubmitTaskCard({ task, requirements, onSubmitted }: { task: Task; requirements: Requirement[]; onSubmitted: () => void }) {
  const initial = requirements.map((item) => ({ type: item.type, label: item.label || evidenceLabels[item.type], url: "" }));
  const [summary, setSummary] = useState("");
  const [aar, setAar] = useState("");
  const [selfEval, setSelfEval] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>(initial);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [allowAiReview, setAllowAiReview] = useState(false);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [previewToken, setPreviewToken] = useState("");
  const invalidatePreview = () => { setAiReview(null); setPreviewToken(""); };
  const draftPayload = () => ({ result_summary: summary, aar_text: aar, self_evaluation_text: selfEval, evidence_items: evidence.filter((item) => item.url.trim()), uploaded_files: uploadedFiles });
  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (uploadedFiles.length + files.length > 5) { setMessage("每次提交最多上传 5 个文件"); return; }
    invalidatePreview(); setUploading(true); setMessage("");
    for (const file of Array.from(files)) {
      const form = new FormData(); form.set("file", file);
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.task_id)}/attachments`, { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) { setMessage(payload.error || `${file.name} 上传失败`); setUploading(false); return; }
      setUploadedFiles((current) => [...current, payload.file]);
    }
    setUploading(false); setMessage("文件已上传到飞书，提交任务后会正式关联到本次记录。");
  };
  const preview = async () => {
    if (!allowAiReview) { setMessage("请先勾选允许使用 DeepSeek 初评"); return; }
    setReviewing(true); setMessage("");
    const response = await fetch(`/api/tasks/${encodeURIComponent(task.task_id)}/ai-review-preview`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draftPayload(), allow_external_ai: true }),
    });
    const payload = await response.json(); setReviewing(false);
    if (!response.ok) { setMessage(payload.error || "AI 初评失败"); return; }
    setAiReview(payload.review); setPreviewToken(payload.preview_token);
    setMessage("AI 初评已生成。你可以继续修改，或确认提交给带教。");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (allowAiReview && !previewToken) { setMessage("请先获取 AI 初评，再决定是否正式提交"); return; }
    setSaving(true); setMessage("");
    const response = await fetch(`/api/tasks/${encodeURIComponent(task.task_id)}/submissions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draftPayload(), allow_external_ai: allowAiReview, ai_preview_token: previewToken }),
    });
    const payload = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(payload.error || "提交失败"); return; }
    const aiText = payload.ai_review_status === "completed" ? "本次 AI 初评已随提交永久保存。" : payload.ai_review_status === "demo_fallback" ? "本地演示初评已随提交保存。" : "";
    setMessage(`提交成功，已进入带教验收队列。${aiText}`); onSubmitted();
  };
  return <form onSubmit={submit} className="sticky top-6 rounded-2xl border border-primary-100 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2"><Send className="h-5 w-5 text-primary-600" /><h2 className="font-semibold text-gray-900">提交任务成果</h2></div>
    <p className="mt-2 text-xs leading-5 text-gray-500">先获取 AI 初评并查看建议，再决定修改或正式提交给带教。只有任务明确要求代码时才必须填写 GitHub。</p>
    <label className="mt-4 block text-sm font-medium text-gray-700">成果摘要 *</label>
    <textarea required rows={3} value={summary} onChange={(event) => { setSummary(event.target.value); invalidatePreview(); }} className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" />
    <div className="mt-4 rounded-xl border border-dashed border-primary-200 bg-primary-50/40 p-3">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium text-gray-800">直接上传本地文件</p><p className="mt-1 text-[11px] text-gray-500">PDF、Word、Excel、PPT 等，当前单个不超过 20MB，最多 5 个。</p></div><label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-medium text-primary-700 shadow-sm"><input type="file" multiple className="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.md,.zip" disabled={uploading} onChange={(event) => { void uploadFiles(event.target.files); event.currentTarget.value = ""; }} />{uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{uploading ? "上传中" : "选择文件"}</label></div>
      {uploadedFiles.length > 0 && <div className="mt-3 space-y-2">{uploadedFiles.map((file) => <div key={file.file_token} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs"><span className="min-w-0 truncate text-gray-700"><Paperclip className="mr-1 inline h-3 w-3" />{file.name}</span><button type="button" onClick={() => { setUploadedFiles((current) => current.filter((item) => item.file_token !== file.file_token)); invalidatePreview(); }} className="ml-2 text-gray-400 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>}
    </div>
    <div className="mt-4 space-y-3">{evidence.map((item, index) => <div key={index} className="rounded-xl bg-gray-50 p-3"><div className="flex gap-2"><select value={item.type} onChange={(event) => { setEvidence((current) => current.map((value, i) => i === index ? { ...value, type: event.target.value as EvidenceType, label: evidenceLabels[event.target.value as EvidenceType] } : value)); invalidatePreview(); }} className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs">{Object.entries(evidenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={() => { setEvidence((current) => current.filter((_, i) => i !== index)); invalidatePreview(); }} className="text-gray-400"><Trash2 className="h-4 w-4" /></button></div><input type="url" required={requirements.some((requirement) => requirement.required && requirement.type === item.type) && !uploadedFiles.some((file) => file.evidence_type === item.type)} placeholder="https://...（上传文件后可不填）" value={item.url} onChange={(event) => { setEvidence((current) => current.map((value, i) => i === index ? { ...value, url: event.target.value } : value)); invalidatePreview(); }} className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs" /></div>)}</div>
    <button type="button" onClick={() => { setEvidence((current) => [...current, { type: "document", label: evidenceLabels.document, url: "" }]); invalidatePreview(); }} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary-600"><Plus className="h-3 w-3" />添加交付链接</button>
    <label className="mt-4 block text-sm font-medium text-gray-700">AAR 复盘</label><textarea rows={3} value={aar} onChange={(event) => { setAar(event.target.value); invalidatePreview(); }} className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" />
    <label className="mt-4 block text-sm font-medium text-gray-700">自我评价</label><textarea rows={2} value={selfEval} onChange={(event) => { setSelfEval(event.target.value); invalidatePreview(); }} className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" />
    <label className="mt-4 flex items-start gap-2 rounded-xl border border-purple-100 bg-purple-50/50 p-3 text-xs leading-5 text-purple-900"><input type="checkbox" checked={allowAiReview} onChange={(event) => { setAllowAiReview(event.target.checked); invalidatePreview(); }} className="mt-1" /><span>允许将成果摘要、AAR、自评和证据名称发送给 DeepSeek 进行初评。不会发送附件原文或原始业务数据。</span></label>
    <button type="button" onClick={() => void preview()} disabled={!allowAiReview || reviewing || saving || uploading} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-medium text-primary-700 disabled:opacity-50">{reviewing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{reviewing ? "AI 正在初评，请稍候..." : aiReview ? "重新获取 AI 初评" : "先获取 AI 初评"}</button>
    {aiReview && <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/40 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-purple-900">AI 提交前初评</p><span className="rounded-full bg-white px-2.5 py-1 text-lg font-bold text-purple-700">{aiReview.scoreTotal}</span></div><p className="mt-3 text-xs leading-5 text-gray-700">{aiReview.feedback}</p><div className="mt-3 space-y-2 text-xs"><p><span className="font-medium text-emerald-700">优点：</span>{aiReview.strengths}</p><p><span className="font-medium text-amber-700">不足：</span>{aiReview.weaknesses}</p><p><span className="font-medium text-primary-700">建议：</span>{aiReview.suggestions}</p></div><p className="mt-3 text-[11px] text-purple-700">修改上面的任何内容后，需要重新初评；确认提交后，这份结果会随提交永久保存。</p></div>}
    {message && <p className={`mt-3 rounded-lg p-2 text-xs ${message.startsWith("提交成功") || message.startsWith("文件已上传") || message.startsWith("AI 初评已生成") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</p>}
    <button disabled={saving || uploading || reviewing || (allowAiReview && !previewToken)} className="mt-4 w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? "正在保存提交与初评..." : allowAiReview ? previewToken ? "确认提交给带教" : "请先完成 AI 初评" : "不使用 AI，直接提交给带教"}</button>
  </form>;
}
