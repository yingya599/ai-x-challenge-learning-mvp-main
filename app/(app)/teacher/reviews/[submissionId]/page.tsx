"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Github,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Star,
  User,
  XCircle,
} from "lucide-react";
import {
  fetchCurrentUser,
  fetchSubmissionById,
  submitTeacherReview,
  type EvaluationData,
  type SubmissionListItem,
} from "@/lib/api";
import { formatTime } from "@/lib/format";

function EvidenceCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <div className="mt-4 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

export default function TeacherReviewDetailPage() {
  const params = useParams<{ submissionId: string }>();
  const router = useRouter();
  const submissionId = params.submissionId;
  const [submission, setSubmission] = useState<SubmissionListItem | null>(null);
  const [aiEvaluation, setAiEvaluation] = useState<EvaluationData | null>(null);
  const [teacherEvaluation, setTeacherEvaluation] = useState<EvaluationData | null>(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [score, setScore] = useState(80);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadReview = useCallback(async () => {
    setLoading(true);
    setError("");

    const user = await fetchCurrentUser();
    if (!user.ok) {
      router.replace("/login");
      return;
    }

    const currentRole = user.role || "";
    setRole(currentRole);
    if (!["teacher", "admin", "ta"].includes(currentRole)) {
      router.replace(`/submissions/${encodeURIComponent(submissionId)}`);
      return;
    }

    const detail = await fetchSubmissionById(submissionId);
    if (!detail.ok || !detail.submission) {
      setSubmission(null);
      setError(detail.error || "加载提交记录失败");
      setLoading(false);
      return;
    }

    setSubmission(detail.submission);
    setAiEvaluation(detail.evaluation || null);
    setTeacherEvaluation(detail.teacher_evaluation || null);
    if (!detail.teacher_evaluation && detail.evaluation?.score_total !== undefined) {
      setScore(detail.evaluation.score_total);
    }
    setLoading(false);
  }, [router, submissionId]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const handleReview = async (action: "accept" | "return") => {
    const normalizedFeedback = feedback.trim();
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setResult({ ok: false, message: "分数必须在 0–100 之间" });
      return;
    }
    if (!normalizedFeedback) {
      setResult({ ok: false, message: "请先填写终审评语" });
      return;
    }

    const actionLabel = action === "accept" ? "接受该提交" : "退回该提交";
    if (!window.confirm(`确认${actionLabel}吗？提交后本页面将锁定终审表单。`)) {
      return;
    }

    setSubmitting(true);
    setResult(null);
    const response = await submitTeacherReview({
      submissionId,
      action,
      score,
      feedback: normalizedFeedback,
    });
    setSubmitting(false);

    if (!response.ok) {
      setResult({ ok: false, message: response.error || "终审提交失败" });
      return;
    }

    setResult({
      ok: true,
      message: action === "accept" ? "已接受该提交" : "已退回该提交",
    });
    await loadReview();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary-600" />
        <p className="text-sm">正在加载完整提交证据...</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
        <XCircle className="mx-auto h-9 w-9 text-red-400" />
        <h1 className="mt-3 text-lg font-semibold text-gray-900">无法打开这条提交</h1>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => void loadReview()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <RefreshCw className="h-4 w-4" />
            重试
          </button>
          <Link
            href="/teacher#submissions"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            返回评审队列
          </Link>
        </div>
      </div>
    );
  }

  const backHref = submission.challenge_id
    ? `/teacher?challengeId=${encodeURIComponent(submission.challenge_id)}#submissions`
    : "/teacher#submissions";
  const canFinalize = role === "teacher" || role === "admin";

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        返回评审队列
      </Link>

      <header className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-gray-400">{submission.submission_id}</span>
              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                {teacherEvaluation ? "终审已完成" : "待教师终审"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">{submission.project_title}</h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {submission.student_name}（{submission.student_id}）
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatTime(submission.submitted_at)}
              </span>
            </div>
          </div>
          {submission.github_repo_url && (
            <a
              href={submission.github_repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Github className="h-4 w-4" />
              打开 GitHub 仓库
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-6">
          <EvidenceCard title="项目摘要">
            <p className="whitespace-pre-wrap">
              {submission.project_summary || "学生暂未填写项目摘要。"}
            </p>
          </EvidenceCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <EvidenceCard title="AAR 复盘">
              <p className="whitespace-pre-wrap">
                {submission.aar_text || "学生暂未填写 AAR 复盘。"}
              </p>
            </EvidenceCard>
            <EvidenceCard title="学生自评">
              <p className="whitespace-pre-wrap">
                {submission.self_evaluation_text || "学生暂未填写自评。"}
              </p>
            </EvidenceCard>
          </div>

          <section className="rounded-xl border border-purple-100 bg-white p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI 初评参考
            </h2>
            {aiEvaluation ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-50">
                    <span className="text-2xl font-bold text-purple-700">{aiEvaluation.score_total}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">AI 综合评分</p>
                    <p className="text-xs text-gray-500">仅供教师终审参考</p>
                  </div>
                </div>
                {aiEvaluation.feedback && (
                  <div className="rounded-lg bg-purple-50 p-4 text-sm text-purple-900">
                    {aiEvaluation.feedback}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {aiEvaluation.strengths && (
                    <div className="rounded-lg bg-green-50 p-4">
                      <p className="flex items-center gap-1 text-xs font-medium text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 优点
                      </p>
                      <p className="mt-2 text-sm text-green-900">{aiEvaluation.strengths}</p>
                    </div>
                  )}
                  {aiEvaluation.weaknesses && (
                    <div className="rounded-lg bg-amber-50 p-4">
                      <p className="flex items-center gap-1 text-xs font-medium text-amber-700">
                        <AlertCircle className="h-3.5 w-3.5" /> 不足
                      </p>
                      <p className="mt-2 text-sm text-amber-900">{aiEvaluation.weaknesses}</p>
                    </div>
                  )}
                  {aiEvaluation.suggestions && (
                    <div className="rounded-lg bg-blue-50 p-4">
                      <p className="flex items-center gap-1 text-xs font-medium text-blue-700">
                        <Lightbulb className="h-3.5 w-3.5" /> 建议
                      </p>
                      <p className="mt-2 text-sm text-blue-900">{aiEvaluation.suggestions}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">暂无 AI 初评结果。</p>
            )}
          </section>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-6">
          {teacherEvaluation ? (
            <section className="rounded-xl border border-green-200 bg-green-50/40 p-5">
              <div className="flex items-center gap-2 text-green-800">
                <Lock className="h-4 w-4" />
                <h2 className="text-sm font-semibold">教师终审已锁定</h2>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
                  <span className="text-2xl font-bold text-green-700">{teacherEvaluation.score_total}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">最终评分</p>
                  <p className="text-xs text-gray-500">{formatTime(teacherEvaluation.created_at)}</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-white p-4">
                <p className="text-xs font-medium text-gray-500">终审评语</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
                  {teacherEvaluation.feedback || "未填写评语"}
                </p>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-green-700">
                此提交已有教师评价，页面不再提供重复终审入口。
              </p>
            </section>
          ) : canFinalize ? (
            <section className="rounded-xl border border-primary-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <Star className="h-5 w-5 text-primary-600" />
                教师终审
              </h2>
              <p className="mt-1 text-xs text-gray-500">操作区会固定在首屏，提交前请确认评分与评语。</p>

              <div className="mt-5">
                <label className="text-sm font-medium text-gray-800">最终评分（0–100）</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(event) => setScore(Number(event.target.value))}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-lg font-semibold focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-800">终审评语</label>
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  rows={4}
                  placeholder="说明作品质量、通过理由或需要修改的具体内容..."
                  className="mt-2 w-full resize-y rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              {result && (
                <div className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {result.message}
                </div>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => void handleReview("accept")}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  接受
                </button>
                <button
                  onClick={() => void handleReview("return")}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  退回
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <MessageSquare className="h-4 w-4" />
                只读查看
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-amber-800">
                助教账号可以查看完整提交证据，但当前没有教师终审权限。
              </p>
            </section>
          )}

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">提交信息</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Challenge ID</dt>
                <dd className="break-all text-right font-mono text-xs text-gray-900">
                  {submission.challenge_id || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">分支</dt>
                <dd className="text-gray-900">{submission.github_branch || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">状态</dt>
                <dd className="text-gray-900">{submission.status || "—"}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
