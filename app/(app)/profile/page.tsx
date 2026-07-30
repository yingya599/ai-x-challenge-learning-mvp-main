"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  User,
  Github,
  Mail,
  BookOpen,
  CheckCircle2,
  Clock,
  Award,
  TrendingUp,
  ExternalLink,
  Loader2,
  Key,
  Download,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Bot,
} from "lucide-react";
import {
  fetchCurrentUser,
  fetchSubmissions,
  fetchPortfolio,
  type SubmissionListItem,
} from "@/lib/api";
import type { PortfolioItem } from "@/lib/data";

export default function ProfilePage() {
  const [user, setUser] = useState<{ person: string; role: string; name?: string } | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  // T08: API Key management — key only shown after generation, not from /me
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [keyError, setKeyError] = useState("");

  // Feishu Bot binding
  const [botAppId, setBotAppId] = useState("");
  const [botAppSecret, setBotAppSecret] = useState("");
  const [botSaving, setBotSaving] = useState(false);
  const [botResult, setBotResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [botBound, setBotBound] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchCurrentUser(),
      fetchSubmissions(),
      fetchPortfolio(),
    ]).then(([userRes, subsRes, portRes]) => {
      if (userRes.ok && userRes.person) {
        setUser({
          person: userRes.person,
          role: userRes.role || "student",
          name: userRes.name,
        });
      }
      if (subsRes.ok && subsRes.submissions) {
        const mine = userRes.person
          ? subsRes.submissions.filter((s) => s.student_id === userRes.person)
          : subsRes.submissions;
        setSubmissions(mine);
      }
      if (portRes.live) setPortfolio(portRes.items);
      setLoading(false);
    });
  }, []);

  // T08: Generate / rotate API key (plaintext returned only once)
  const handleGenerateKey = useCallback(async () => {
    setGenerating(true);
    setKeyError("");
    try {
      const res = await fetch("/api/auth/api-key", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setApiKey(data.api_key);
        setShowKey(true);
      } else {
        setKeyError(data.error || "生成失败");
      }
    } catch {
      setKeyError("网络错误，请重试");
    }
    setGenerating(false);
  }, []);

  // Save Feishu Bot credentials
  const handleSaveBot = useCallback(async () => {
    if (!botAppId.trim() || !botAppSecret.trim()) {
      setBotResult({ ok: false, message: "请填写 App ID 和 App Secret" });
      return;
    }
    setBotSaving(true);
    setBotResult(null);
    try {
      const res = await fetch("/api/auth/me");
      const me = await res.json();
      if (!me.ok) throw new Error("未登录");

      const saveRes = await fetch("/api/auth/bind-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feishuAppId: botAppId.trim(), feishuAppSecret: botAppSecret.trim() }),
      });
      const data = await saveRes.json();
      if (data.ok) {
        setBotBound(true);
        setBotResult({ ok: true, message: "飞书 Bot 绑定成功" });
      } else {
        setBotResult({ ok: false, message: data.error || "绑定失败" });
      }
    } catch (e) {
      setBotResult({ ok: false, message: e instanceof Error ? e.message : "网络错误" });
    }
    setBotSaving(false);
  }, [botAppId, botAppSecret]);

  const handleDownloadConfig = useCallback(() => {
    if (!apiKey || !user) return;
    const config = {
      agent_id: `student-companion-${user.person}`,
      api_key: apiKey,
      server: process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin,
      auth: {
        method: "header",
        header_name: "x-api-key",
      },
      endpoints: {
        submit: { method: "POST", path: "/api/nseap", description: "提交作业" },
        health: { method: "GET", path: "/api/health", description: "健康检查" },
        agents: { method: "GET", path: "/api/agents", description: "Agent 列表" },
      },
      message_types: {
        submission_request: {
          description: "提交作业",
          payload: {
            studentId: { type: "string", required: true, description: "学号" },
            challengeId: { type: "string", required: true, description: "Challenge ID" },
            projectTitle: { type: "string", required: true, description: "项目标题" },
            projectSummary: { type: "string", required: true, description: "项目简介" },
            githubRepoUrl: { type: "string", required: true, description: "GitHub 仓库地址" },
            aarText: { type: "string", required: true, description: "AAR 复盘" },
            selfEvaluationText: { type: "string", required: true, description: "自评" },
            isPublic: { type: "boolean", required: false, description: "是否公开" },
          },
          transport: "Redis Stream (消息总线，异步处理)",
        },
      },
      protocol: "NSEAP Agent Protocol v1.0 / P3394-compatible",
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nseap-config-${user.person}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [apiKey, user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        <p className="mt-3 text-sm text-gray-500">加载中...</p>
      </div>
    );
  }

  const completedCount = submissions.filter(
    (s) => s.status === "accepted" || s.task_state === "COMPLETED"
  ).length;
  const avgScore = submissions.length > 0
    ? Math.round(submissions.reduce((a, s) => a + (s.score_total || 0), 0) / submissions.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* 个人信息卡片 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700">
            {(user?.name || "?").charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">
                {user?.name || "未登录"}
              </h1>
              <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                {user?.role === "teacher" ? "教师" : "学生"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {user?.person || "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* T08: API Key — generate on demand, shown only once */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-3">
          <Key className="h-5 w-5 text-amber-500" />
          <h2 className="text-base font-semibold text-gray-900">API Key</h2>
          <span className="text-xs text-gray-400">用于 Companion Agent / 命令行提交</span>
        </div>

        {!apiKey ? (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              点击生成 API Key，密钥仅在生成时显示一次，请立即保存。
            </p>
            <button
              onClick={handleGenerateKey}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {generating ? "生成中..." : "生成 API Key"}
            </button>
            {keyError && <p className="mt-2 text-sm text-red-500">{keyError}</p>}
          </div>
        ) : (
          <div>
            <p className="text-sm text-amber-600 mb-2">
              ⚠️ 密钥仅在本次显示，请立即复制或下载配置文件。
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 font-mono break-all select-all">
                {showKey ? apiKey : "•".repeat(48)}
              </code>
              <button
                onClick={() => setShowKey(!showKey)}
                className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
                title={showKey ? "隐藏" : "显示"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
                title="复制"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                onClick={handleDownloadConfig}
                className="rounded-lg border border-gray-200 p-2 text-primary-600 hover:bg-primary-50"
                title="下载配置文件"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { setApiKey(null); setShowKey(false); }}
                className="text-xs text-primary-600 hover:underline"
              >
                重新生成
              </button>
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-400">
          下载配置文件到 Companion Agent 目录即可使用。切勿分享给他人。
        </p>
      </div>

      {/* 飞书 Bot 绑定 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="h-5 w-5 text-green-500" />
          <h2 className="text-base font-semibold text-gray-900">飞书 Bot 绑定</h2>
          <span className="text-xs text-gray-400">绑定你自己的飞书机器人</span>
        </div>

        {botBound ? (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            ✅ 飞书 Bot 已绑定。通知将通过你的 Bot 发送。
            <button onClick={() => setBotBound(false)} className="ml-3 text-green-600 underline text-xs">重新绑定</button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              在飞书开放平台创建应用 → 获取 App ID 和 App Secret → 填入下方。
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">App ID</label>
                <input type="text" value={botAppId} onChange={(e) => setBotAppId(e.target.value)}
                  placeholder="cli_xxxxxxxxxxxx" className="mt-1 w-full rounded-lg border border-gray-200 py-2 px-3 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">App Secret</label>
                <input type="password" value={botAppSecret} onChange={(e) => setBotAppSecret(e.target.value)}
                  placeholder="••••••••••••••••" className="mt-1 w-full rounded-lg border border-gray-200 py-2 px-3 text-sm font-mono" />
              </div>
              {botResult && (
                <div className={`rounded-lg p-2 text-xs ${botResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {botResult.message}
                </div>
              )}
              <button onClick={handleSaveBot} disabled={botSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {botSaving ? "保存中..." : "保存绑定"}
              </button>
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-400">
          绑定后提交作业、收到评审等通知将通过你自己的 Bot 发送，而不是系统 Bot。
        </p>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-sm text-gray-500">提交数</p>
          <p className="text-2xl font-bold text-gray-900">{submissions.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">已完成</p>
          <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">平均分</p>
          <p className="text-2xl font-bold text-gray-900">{avgScore}</p>
        </div>
      </div>

      {/* 提交记录 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">提交记录</h2>
        {submissions.length === 0 ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
            暂无提交，<Link href="/submit" className="text-primary-600 hover:underline">去提交</Link>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {submissions.slice(0, 10).map((s) => (
              <Link
                key={s.submission_id}
                href={`/submissions/${s.submission_id}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-all"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{s.project_title}</p>
                  <p className="text-xs text-gray-500">{s.submitted_at || "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  {s.score_total != null && (
                    <span className="text-sm font-medium text-gray-700">{s.score_total}分</span>
                  )}
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.status === "accepted" || s.task_state === "COMPLETED"
                      ? "bg-green-50 text-green-700"
                      : s.status === "needs_revision"
                      ? "bg-red-50 text-red-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {s.task_state || s.status || "处理中"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 作品集 */}
      {portfolio.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900">作品集</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {portfolio.slice(0, 4).map((p) => (
              <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="font-medium text-gray-900">{p.challengeTitle}</h3>
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{p.summary}</p>
                {p.githubRepo && (
                  <a href={`https://github.com/${p.githubRepo}`} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                    <ExternalLink className="h-3 w-3" /> 仓库
                  </a>
                )}
              </div>
            ))}
          </div>
          <Link href="/portfolio" className="mt-2 inline-block text-sm text-primary-600 hover:underline">
            查看全部 →
          </Link>
        </div>
      )}
    </div>
  );
}
