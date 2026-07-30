"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Github,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { type Challenge } from "@/lib/data";
import { fetchChallenges, checkGithubRepo, submitProject, fetchCurrentUser } from "@/lib/api";

type Step = "select" | "fill" | "checking" | "result";

interface CheckItem {
  label: string;
  key: string;
  ok: boolean;
  message: string;
}

export default function SubmitPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [studentId, setStudentId] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectSummary, setProjectSummary] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [aarText, setAarText] = useState("");
  const [selfEvaluationText, setSelfEvaluationText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchChallenges().then((r) => setChallenges(r.items));
    // T9: Read studentId from session
    fetchCurrentUser().then((user) => {
      if (user.ok && user.person) {
        setStudentId(user.person);
      } else {
        router.push("/login");
      }
    });
  }, []);
  const [selectedChallenge, setSelectedChallenge] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");
  const [checkResults, setCheckResults] = useState<CheckItem[]>([
    { label: "README.md", key: "readme", ok: false, message: "检查中..." },
    { label: "Git 提交历史", key: "commits", ok: false, message: "检查中..." },
    { label: "Demo / 部署链接", key: "demo", ok: false, message: "检查中..." },
    { label: "复盘文档 (reflection.md)", key: "reflection", ok: false, message: "检查中..." },
  ]);
  const [submitDone, setSubmitDone] = useState(false);
  const [allPassed, setAllPassed] = useState(false);
  const [error, setError] = useState("");

  const handleStartSubmit = () => {
    if (!selectedChallenge) return;
    setStep("fill");
  };

  const handleCheck = async () => {
    if (!githubRepo.trim()) {
      setError("请输入 GitHub 仓库地址");
      return;
    }
    setError("");
    setStep("checking");

    const repoUrl = githubRepo.startsWith("http") ? githubRepo : `https://github.com/${githubRepo}`;
    const check = await checkGithubRepo(repoUrl);
    const results: CheckItem[] = check
      ? [
          { label: "GitHub 仓库", key: "repo", ok: check.repoExists, message: check.repoExists ? "仓库存在且可访问" : "仓库不存在或不可访问" },
          { label: "README.md", key: "readme", ok: check.readmeExists, message: check.readmeExists ? "README.md 存在" : "未找到 README.md" },
          { label: "Git 提交历史", key: "commits", ok: !!check.latestCommitAt, message: check.latestCommitAt ? `最近提交：${check.latestCommitAt}` : "未获取到提交记录" },
          { label: "AAR 复盘", key: "reflection", ok: aarText.trim().length > 0, message: aarText.trim() ? "已填写 AAR 复盘" : "请填写 AAR 复盘内容" },
        ]
      : [{ label: "GitHub 仓库", key: "repo", ok: false, message: "检查服务不可用，请稍后重试" }];
    setCheckResults(results);
    setAllPassed(results.every((r) => r.ok));
    setStep("result");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    const repoUrl = githubRepo.startsWith("http") ? githubRepo : `https://github.com/${githubRepo}`;
    const result = await submitProject({
      studentId,
      challengeId: selectedChallenge,
      projectTitle,
      projectSummary,
      githubRepoUrl: repoUrl,
      githubBranch: githubBranch || undefined,
      demoUrl: demoUrl || undefined,
      aarText,
      selfEvaluationText,
      isPublic: true,
    });
    setSubmitting(false);
    if (result.ok) {
      setSubmitDone(true);
    } else {
      setError(result.error || "提交失败，请检查填写内容");
    }
  };

  const resetForm = () => {
    setStep("select");
    setSelectedChallenge("");
    setGithubRepo("");
    setGithubBranch("main");
    setSubmitDone(false);
    setAllPassed(false);
    setError("");
  };

  if (submitDone) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-gray-900">提交成功！</h2>
        <p className="mt-2 text-sm text-gray-500">你的项目已进入评审队列，AI 初评结果将在几分钟内生成。</p>
        <div className="mt-8 flex gap-4">
          <button onClick={resetForm} className="btn-primary">继续提交</button>
          <button onClick={() => router.push("/portfolio")} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            查看作品集
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <button onClick={() => step !== "select" ? setStep("select") : router.push("/lms")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> 返回
      </button>

      {/* Step 指示器 */}
      <div className="flex items-center gap-4">
        {[
          { label: "选择 Challenge", key: "select" as Step },
          { label: "填写信息", key: "fill" as Step },
          { label: "检查结果", key: "result" as Step },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              ["select", "fill", "result"].indexOf(step) >= i ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-400"
            }`}>{i + 1}</div>
            <span className={`text-sm ${["select", "fill", "result"].indexOf(step) >= i ? "font-medium text-gray-900" : "text-gray-400"}`}>{s.label}</span>
            {i < 2 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
          </div>
        ))}
      </div>

      {step === "select" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">选择 Challenge</h2>
          <p className="mt-1 text-sm text-gray-500">选择你要提交的挑战项目</p>
          <div className="mt-4 space-y-2">
            {challenges.filter((c) => c.status !== "已完成").map((c) => (
              <label key={c.id} className={`flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors ${
                selectedChallenge === c.id ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300"
              }`}>
                <input type="radio" name="challenge" value={c.id} checked={selectedChallenge === c.id} onChange={() => setSelectedChallenge(c.id)} className="h-4 w-4 text-primary-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{c.number}: {c.title}</p>
                  <p className="text-xs text-gray-500">{c.description}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  c.difficulty === "入门" ? "bg-green-50 text-green-700" : c.difficulty === "进阶" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                }`}>{c.difficulty}</span>
              </label>
            ))}
          </div>
          <button onClick={handleStartSubmit} disabled={!selectedChallenge} className="btn-primary mt-6">
            下一步
          </button>
        </div>
      )}

      {(step === "fill" || step === "checking") && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">填写提交信息</h2>
          <p className="mt-1 text-sm text-gray-500">关联你的 GitHub 项目</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900">GitHub 仓库地址</label>
              <div className="relative mt-1">
                <Github className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input type="text" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} placeholder="例如: zhangsan-dev/nseap-landing" className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
              <p className="mt-1 text-xs text-gray-400">格式: {`<用户名>/<仓库名>`}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900">分支 (可选)</label>
              <input type="text" value={githubBranch} onChange={(e) => setGithubBranch(e.target.value)} placeholder="main" className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900">学生 ID（自动获取）</label>
                <input type="text" value={studentId} readOnly className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm text-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">项目名称</label>
                <input type="text" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="项目标题" className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900">项目简介</label>
              <textarea value={projectSummary} onChange={(e) => setProjectSummary(e.target.value)} rows={2} placeholder="一两句话说明项目做了什么" className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900">Demo 链接 (可选)</label>
              <input type="text" value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900">AAR 复盘</label>
              <textarea value={aarText} onChange={(e) => setAarText(e.target.value)} rows={3} placeholder="做了什么 / 遇到什么问题 / 学到了什么" className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900">自评</label>
              <textarea value={selfEvaluationText} onChange={(e) => setSelfEvaluationText(e.target.value)} rows={2} placeholder="对本次项目的自我评价" className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>

          {step === "checking" ? (
            <div className="mt-6 rounded-lg bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在检查 GitHub 仓库...
              </div>
              <div className="mt-3 space-y-2">
                {checkResults.map((item) => (
                  <div key={item.key} className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                    <span className="text-gray-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <button onClick={handleCheck} className="btn-primary mt-6">
              开始检查
            </button>
          )}
        </div>
      )}

      {step === "result" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">检查结果</h2>
          <p className="mt-1 text-sm text-gray-500">以下是对 GitHub 仓库的自动检查结果</p>
          <div className="mt-4 space-y-3">
            {checkResults.map((item) => (
              <div key={item.key} className={`flex items-start gap-3 rounded-lg border p-3 ${
                item.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
              }`}>
                {item.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: item.ok ? "rgb(21,128,61)" : "rgb(185,28,28)" }}>{item.label}</p>
                  <p className="text-xs" style={{ color: item.ok ? "rgb(22,163,74)" : "rgb(220,38,38)" }}>{item.message}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="text-xs text-amber-700">
              检查结果仅供参考，最终评审由老师和 Review Agent 完成。如果缺少某些项目，建议在提交前补充完善。
            </p>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex gap-3">
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">{submitting ? "提交中..." : "确认提交"}</button>
            <button onClick={() => setStep("fill")} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">返回修改</button>
          </div>
        </div>
      )}
    </div>
  );
}

