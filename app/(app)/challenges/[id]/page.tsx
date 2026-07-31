"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Github,
  ListChecks,
  RefreshCw,
  Send,
  Tag,
  Target,
} from "lucide-react";
import { fetchChallengeById, fetchCurrentUser } from "@/lib/api";
import type { Challenge } from "@/lib/data";

function splitList(value?: string) {
  return value
    ? value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean)
    : [];
}

export default function ChallengeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotFound(false);

    const [result, user] = await Promise.all([
      fetchChallengeById(id),
      fetchCurrentUser(),
    ]);
    setRole(user.ok ? user.role || null : null);
    if (result.ok && result.challenge) {
      setChallenge(result.challenge);
    } else {
      setChallenge(null);
      setNotFound(result.status === 404);
      setError(result.error || "加载 Challenge 失败");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Clock className="mb-3 h-8 w-8 animate-spin" />
        <p className="text-sm">正在加载 Challenge 详情...</p>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20 text-center">
        <FileText className="mb-3 h-9 w-9 text-gray-300" />
        <h1 className="text-lg font-semibold text-gray-900">
          {notFound ? "没有找到这个 Challenge" : "Challenge 加载失败"}
        </h1>
        <p className="mt-2 max-w-md text-sm text-gray-500">{error}</p>
        <div className="mt-6 flex gap-3">
          {!notFound && (
            <button
              onClick={() => void loadChallenge()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <RefreshCw className="h-4 w-4" />
              重新加载
            </button>
          )}
          <Link
            href="/lms"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            返回 LMS
          </Link>
        </div>
      </div>
    );
  }

  const deliverables = splitList(challenge.deliverables);
  const skills = splitList(challenge.skills);
  const isStudent = role === "student";
  const isReviewer = role === "teacher" || role === "admin" || role === "ta";

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/lms" className="hover:text-gray-700">LMS</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900">{challenge.title}</span>
      </nav>

      <header className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-gray-400">
                {challenge.number || challenge.id}
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {challenge.status}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">{challenge.title}</h1>
            <p className="mt-3 max-w-3xl text-gray-600">
              {challenge.description || "暂未填写 Challenge 简介"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            {challenge.github_repo && (
              <a
                href={challenge.github_repo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Github className="h-4 w-4" />
                查看 GitHub 资料
              </a>
            )}
            {isStudent && (
              <Link
                href={`/submit?challengeId=${encodeURIComponent(challenge.id)}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Send className="h-4 w-4" />
                提交 Challenge
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
            {isReviewer && (
              <Link
                href={`/teacher?challengeId=${encodeURIComponent(challenge.id)}#submissions`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                <ClipboardCheck className="h-4 w-4" />
                查看提交并评审
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <main className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Target className="h-5 w-5 text-primary-600" />
              Challenge 目标
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {challenge.objective || challenge.description || "暂未填写目标"}
            </p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <ListChecks className="h-5 w-5 text-primary-600" />
              交付物
            </h2>
            {deliverables.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {deliverables.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-gray-500">暂未填写交付物</p>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Award className="h-5 w-5 text-primary-600" />
              评分标准
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {challenge.rubric || "暂未填写评分标准"}
            </p>
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">基本信息</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Challenge ID</dt>
                <dd className="break-all text-right font-mono text-xs text-gray-900">{challenge.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">难度</dt>
                <dd className="text-gray-900">{challenge.difficulty}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">状态</dt>
                <dd className="text-gray-900">{challenge.status}</dd>
              </div>
              {challenge.deadline && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">截止时间</dt>
                  <dd className="text-right text-gray-900">{challenge.deadline}</dd>
                </div>
              )}
            </dl>
          </section>

          {skills.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                <Tag className="h-4 w-4" />
                相关技能
              </h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
