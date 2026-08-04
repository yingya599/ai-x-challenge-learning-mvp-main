"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Search } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/management/ManagementUi";
import { formatTime } from "@/lib/format";

type Submission = {
  submission_id: string;
  student_id: string;
  student_name: string;
  project_title: string;
  task_id?: string;
  submitted_at?: string;
  status?: string;
  task_state?: string;
  review_status?: string;
  evidence_items_json?: string;
  github_repo_url?: string;
  attachment_files?: Array<{ file_token: string; name: string }>;
};

export default function ReviewsPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/submissions"), fetch("/api/evaluations")])
      .then(async ([submissionResponse, evaluationResponse]) => {
        const [submissionPayload, evaluationPayload] = await Promise.all([
          submissionResponse.json(),
          evaluationResponse.json(),
        ]);
        if (!submissionResponse.ok) throw new Error(submissionPayload.error || "加载失败");
        setItems(submissionPayload.submissions || []);
        setReviewedIds(new Set(
          (evaluationPayload.evaluations || [])
            .filter((item: { evaluator_type: string; is_effective?: boolean }) => item.evaluator_type === "teacher" && item.is_effective !== false)
            .map((item: { submission_id: string }) => item.submission_id),
        ));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const finalState = (item: Submission) => {
    const state = `${item.task_state || ""} ${item.status || ""} ${item.review_status || ""}`.toLowerCase();
    return reviewedIds.has(item.submission_id) || ["accepted", "completed", "returned", "revision"].some((value) => state.includes(value));
  };
  const filtered = useMemo(() => items.filter((item) =>
    (showAll || !finalState(item)) &&
    (!search || `${item.student_name} ${item.student_id} ${item.project_title}`.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => Date.parse(b.submitted_at || "") - Date.parse(a.submitted_at || "")), [items, reviewedIds, showAll, search]);

  if (error) return <ErrorState message={error} />;
  if (loading) return <LoadingState text="正在加载验收队列..." />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary-600">任务验收</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">待验收队列</h1>
        <p className="mt-1 text-sm text-gray-500">点击一条记录进入独立验收页，提交证据与操作区同时可见。</p>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索实习生或任务..." className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />显示已终审记录</label>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="divide-y divide-gray-100">
          {filtered.map((item) => {
            let evidenceCount = (item.attachment_files || []).length + (item.github_repo_url ? 1 : 0);
            try {
              const parsed = JSON.parse(item.evidence_items_json || "[]");
              if (Array.isArray(parsed)) evidenceCount += parsed.length;
            } catch {}
            const state = `${item.task_state || ""} ${item.status || ""}`.toLowerCase();
            const reviewed = reviewedIds.has(item.submission_id);
            const returned = state.includes("return") || state.includes("revision");
            return (
              <Link key={item.submission_id} href={`/teacher/reviews/${encodeURIComponent(item.submission_id)}`} className="flex flex-col justify-between gap-3 px-5 py-4 hover:bg-primary-50/40 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-primary-50 p-2 text-primary-600"><ClipboardCheck className="h-4 w-4" /></span>
                  <div>
                    <p className="font-medium text-gray-900">{item.project_title}</p>
                    <p className="mt-1 text-xs text-gray-600">{item.student_name || item.student_id}（{item.student_id}）</p>
                    <p className="mt-1 text-xs text-gray-400">{formatTime(item.submitted_at)} · {evidenceCount} 项证据 · {item.task_id || item.submission_id}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${reviewed || state.includes("accepted") ? "bg-emerald-50 text-emerald-700" : returned ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                  {reviewed ? "已终审" : returned ? "已退回" : "待验收"}
                </span>
              </Link>
            );
          })}
          {!filtered.length && <div className="py-14 text-center text-sm text-gray-400">当前没有待验收任务</div>}
        </div>
      </div>
    </div>
  );
}
