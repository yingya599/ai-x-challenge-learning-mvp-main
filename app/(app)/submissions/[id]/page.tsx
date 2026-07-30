"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Github,
  User,
  Calendar,
  MessageSquare,
  Star,
  TrendingUp,
  Lightbulb,
  AlertCircle,
  ArrowUp,
} from "lucide-react";
import { fetchSubmissionById, submitPeerReview, type SubmissionListItem, type PeerReviewStatus, type EvaluationData } from "@/lib/api";
import { formatTime } from "@/lib/format";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  "已提交": { label: "已提交", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
  "检查中": { label: "检查中", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Loader2 },
  "检查失败": { label: "检查失败", color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  "待评审": { label: "待评审", color: "bg-purple-50 text-purple-700 border-purple-200", icon: AlertTriangle },
  "已评分": { label: "已评分", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
};

function mapStatus(s: SubmissionListItem): string {
  const st = s.status || "";
  if (st === "accepted" || st === "reviewed") return "已评分";
  if (st === "pending_review" || st === "under_review" || st === "pending_teacher_review") return "待评审";
  if (st === "needs_revision" || st === "needs_teacher_revision") return "检查失败";
  if (st === "checking" || st === "validating") return "检查中";
  return "已提交";
}

function parseScores(scoresJson?: string): Record<string, number> | null {
  if (!scoresJson) return null;
  try { return JSON.parse(scoresJson); } catch { return null; }
}

export default function SubmissionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [realSub, setRealSub] = useState<SubmissionListItem | null | undefined>(undefined);
  const [peerReview, setPeerReview] = useState<PeerReviewStatus | undefined>(undefined);
  const [aiEval, setAiEval] = useState<EvaluationData | null>(null);
  const [teacherEval, setTeacherEval] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);

  // Peer review form state
  const [prScore, setPrScore] = useState(80);
  const [prFeedback, setPrFeedback] = useState("");
  const [prLoading, setPrLoading] = useState(false);
  const [prResult, setPrResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchSubmissionById(id).then((r) => {
      setRealSub(r.ok && r.submission ? r.submission : null);
      setPeerReview(r.peer_review);
      setAiEval(r.evaluation || null);
      setTeacherEval(r.teacher_evaluation || null);
      setLoading(false);
    });
  }, [id]);

  const handlePeerReview = async () => {
    if (!prFeedback.trim()) {
      setPrResult({ ok: false, message: "请填写评审反馈" });
      return;
    }
    setPrLoading(true);
    setPrResult(null);
    const r = await submitPeerReview({ submissionId: id, score: prScore, feedback: prFeedback.trim() });
    if (r.ok) {
      setPrResult({ ok: true, message: r.message || "同伴评审已提交" });
      setPeerReview({ assigned: true, completed: true });
    } else {
      setPrResult({ ok: false, message: r.error || "提交失败" });
    }
    setPrLoading(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Loader2 className="mb-2 h-8 w-8 animate-spin" />
        <p className="text-sm">加载中...</p>
      </div>
    );
  }

  if (!realSub) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <XCircle className="mb-2 h-8 w-8" />
        <p className="text-sm">提交记录未找到</p>
        <Link href="/portfolio" className="mt-4 text-sm text-primary-600 hover:underline">返回作品集</Link>
      </div>
    );
  }

  const status = statusConfig[mapStatus(realSub)] || statusConfig["已提交"];
  const StatusIcon = status.icon;
  const githubRepo = realSub.github_repo_url?.replace(/^https?:\/\/github\.com\//, "") || "";
  const scores = parseScores(aiEval?.scores_json);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/portfolio" className="hover:text-gray-700">作品集</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900">{realSub.project_title}</span>
      </nav>

      {/* 标题栏 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{realSub.project_title}</h1>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                <StatusIcon className={`h-3.5 w-3.5 ${mapStatus(realSub) === "检查中" ? "animate-spin" : ""}`} />
                {status.label}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {realSub.student_name}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatTime(realSub.submitted_at)}</span>
              {githubRepo && (
                <span className="flex items-center gap-1"><Github className="h-3.5 w-3.5" /> {githubRepo}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* AI 评分详情 */}
          {aiEval ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <TrendingUp className="h-5 w-5 text-primary-600" /> AI 初评结果
              </h2>

              {/* 总分 */}
              <div className="mt-4 flex items-center gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50">
                  <span className="text-3xl font-bold text-primary-600">{aiEval.score_total}</span>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">AI 综合评分</p>
                  <p className="text-sm text-gray-500">基于挑战评分标准自动生成</p>
                </div>
              </div>

              {/* 分项分数 */}
              {scores && Object.keys(scores).length > 0 && (
                <div className="mt-4 rounded-lg bg-gray-50 p-4">
                  <p className="mb-3 text-xs font-medium text-gray-500 uppercase">分项评分</p>
                  <div className="space-y-2">
                    {Object.entries(scores).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{key}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200">
                            <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(val, 100)}%` }} />
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-8 text-right">{val}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 评语 */}
              {aiEval.feedback && (
                <div className="mt-4 rounded-lg bg-blue-50 p-4">
                  <p className="mb-2 flex items-center gap-1 text-xs font-medium text-blue-700">
                    <MessageSquare className="h-3.5 w-3.5" /> 综合评语
                  </p>
                  <p className="text-sm text-blue-800 leading-relaxed">{aiEval.feedback}</p>
                </div>
              )}

              {/* 优点 / 缺点 / 建议 */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {aiEval.strengths && (
                  <div className="rounded-lg bg-green-50 p-4">
                    <p className="mb-2 flex items-center gap-1 text-xs font-medium text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> 优点
                    </p>
                    <p className="text-sm text-green-800">{aiEval.strengths}</p>
                  </div>
                )}
                {aiEval.weaknesses && (
                  <div className="rounded-lg bg-amber-50 p-4">
                    <p className="mb-2 flex items-center gap-1 text-xs font-medium text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" /> 不足
                    </p>
                    <p className="text-sm text-amber-800">{aiEval.weaknesses}</p>
                  </div>
                )}
                {aiEval.suggestions && (
                  <div className="rounded-lg bg-purple-50 p-4">
                    <p className="mb-2 flex items-center gap-1 text-xs font-medium text-purple-700">
                      <Lightbulb className="h-3.5 w-3.5" /> 改进建议
                    </p>
                    <p className="text-sm text-purple-800">{aiEval.suggestions}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <TrendingUp className="h-5 w-5 text-primary-600" /> AI 初评
              </h2>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> AI 初评生成中...
              </div>
            </div>
          )}

          {/* 教师评审 */}
          {teacherEval ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <Star className="h-5 w-5 text-amber-500" /> 教师终评
              </h2>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                  <span className="text-2xl font-bold text-amber-600">{teacherEval.score_total}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">教师评分</p>
                  <p className="text-xs text-gray-500">{formatTime(teacherEval.created_at)}</p>
                </div>
              </div>
              {teacherEval.feedback && (
                <div className="mt-4 rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-700">{teacherEval.feedback}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {/* 同伴评审 */}
          {peerReview?.assigned && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Star className="h-4 w-4 text-purple-600" /> 同伴评审
              </h3>
              {peerReview.completed ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> {prResult?.ok ? prResult.message : "你已完成对该提交的评审"}
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-gray-500">你被分配为该提交的同伴评审人，请打分并给出反馈。</p>
                  <div>
                    <label className="text-xs font-medium text-gray-700">评分（0-100）：{prScore}</label>
                    <input type="range" min={0} max={100} value={prScore}
                      onChange={(e) => setPrScore(Number(e.target.value))}
                      className="mt-1 w-full accent-purple-600" />
                  </div>
                  <textarea value={prFeedback} onChange={(e) => setPrFeedback(e.target.value)} rows={3}
                    placeholder="这个项目做得好的地方 / 可以改进的地方..."
                    className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                  {prResult && !prResult.ok && (
                    <p className="text-xs text-red-600">{prResult.message}</p>
                  )}
                  <button onClick={handlePeerReview} disabled={prLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                    {prLoading && <Loader2 className="h-4 w-4 animate-spin" />} 提交同伴评审
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 教师反馈（等待中） */}
          {!teacherEval && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <MessageSquare className="h-4 w-4 text-primary-600" /> 教师反馈
              </h3>
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                <Clock className="h-4 w-4" /> 待教师评审
              </div>
            </div>
          )}

          {/* 提交信息 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900">提交信息</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">状态</dt>
                <dd className="text-gray-900">{realSub.status || "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">提交时间</dt>
                <dd className="text-gray-900">{formatTime(realSub.submitted_at)}</dd>
              </div>
            </dl>
            {githubRepo && (
              <a href={`https://github.com/${githubRepo}`} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 flex w-full items-center justify-center gap-2 text-sm">
                <Github className="h-4 w-4" /> 查看仓库
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
