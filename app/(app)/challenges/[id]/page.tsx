"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Target,
  CheckCircle2,
  ChevronRight,
  FileText,
  ExternalLink,
  Github,
  Clock,
  Award,
  ListChecks,
  Tag,
} from "lucide-react";

export default function ChallengeDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [challenge, setChallenge] = useState<{
    id: string; number: string; title: string; description: string;
    difficulty: string; status: string; team: string;
    deliverables?: string; rubric?: string; deadline?: string;
    skills?: string; github_repo?: string; objective?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/challenges")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.challenges) {
          const found = data.challenges.find(
            (c: Record<string, unknown>) =>
              c.id === id || c.challenge_id === id
          );
          if (found) {
            setChallenge({
              id: (found.challenge_id || found.id) as string,
              number: (found.number as string) || "",
              title: (found.title as string) || "",
              description: (found.brief || found.objective || found.description || "") as string,
              difficulty: (found.difficulty as string) || "进阶",
              status: (found.status === "closed" ? "已完成" : "进行中") as string,
              team: (found.team as string) || "",
              deliverables: found.deliverables as string,
              rubric: found.rubric as string,
              deadline: found.deadline as string,
              skills: found.skills as string,
              github_repo: found.github_repo as string,
              objective: found.objective as string,
            });
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Clock className="mb-2 h-8 w-8 animate-spin" />
        <p className="text-sm">加载中...</p>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <FileText className="mb-2 h-8 w-8" />
        <p className="text-sm">Challenge 未找到</p>
        <Link href="/lms" className="mt-4 text-sm text-primary-600 hover:underline">返回课程</Link>
      </div>
    );
  }

  const deliverablesList = challenge.deliverables
    ? challenge.deliverables.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const skillsList = challenge.skills
    ? challenge.skills.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/lms" className="hover:text-gray-700">LMS</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900">{challenge.title}</span>
      </nav>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-400">{challenge.number || challenge.id}</span>
              <h1 className="text-2xl font-bold text-gray-900">{challenge.title}</h1>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
                {challenge.status}
              </span>
            </div>
            <p className="mt-3 text-gray-600">{challenge.description}</p>
          </div>
          <div className="flex items-center gap-3">
            {challenge.github_repo && (
              <a href={challenge.github_repo} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                title="在 GitHub 查看">
                <Github className="h-5 w-5" />
              </a>
            )}
            <Link href="/submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
              提交 Challenge <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {challenge.objective && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <Target className="h-5 w-5 text-primary-600" /> Challenge 目标
              </h2>
              <p className="mt-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{challenge.objective}</p>
            </div>
          )}

          {deliverablesList.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <ListChecks className="h-5 w-5 text-primary-600" /> 交付物
              </h2>
              <ul className="mt-4 space-y-2">
                {deliverablesList.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />{d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {challenge.rubric && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <Award className="h-5 w-5 text-primary-600" /> 评分标准
              </h2>
              <p className="mt-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{challenge.rubric}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900">基本信息</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">难度</dt><dd className="text-gray-900">{challenge.difficulty}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">状态</dt><dd className="text-gray-900">{challenge.status}</dd></div>
              {challenge.deadline && <div className="flex justify-between"><dt className="text-gray-500">截止</dt><dd className="text-gray-900">{challenge.deadline}</dd></div>}
              {challenge.team && <div className="flex justify-between"><dt className="text-gray-500">团队</dt><dd className="text-gray-900">{challenge.team}</dd></div>}
            </dl>
          </div>

          {skillsList.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Tag className="h-4 w-4" /> 技能</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skillsList.map((s, i) => (
                  <span key={i} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">{s}</span>
                ))}
              </div>
            </div>
          )}

          {challenge.github_repo && (
            <a href={challenge.github_repo} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Github className="h-5 w-5" /> 在 GitHub 查看完整挑战
            </a>
          )}

          <Link href="/submit" className="btn-primary flex w-full items-center justify-center gap-2 text-sm">
            提交作品 <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
