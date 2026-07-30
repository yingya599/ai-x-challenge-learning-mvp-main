"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users, CheckCircle2, Clock, Search, ChevronRight,
  Star, Download, Github, Eye,
} from "lucide-react";
import { fetchSubmissions, fetchStudents, fetchChallenges, fetchSubmissionById, type SubmissionListItem, type StudentInfo, type EvaluationData } from "@/lib/api";
import { formatDateShort } from "@/lib/format";
import type { Challenge } from "@/lib/data";

interface SubmissionRow {
  id: string;
  studentName: string;
  studentId: string;
  challengeId: string;
  challengeTitle: string;
  githubRepo: string;
  githubRepoUrl: string;
  submittedAt: string;
  aiScore: number;
  status: string;
}

export default function TeacherPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<(Challenge & { github_repo?: string })[]>([]);

  // Publish form
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [pubTitle, setPubTitle] = useState("");
  const [pubBrief, setPubBrief] = useState("");
  const [pubObjective, setPubObjective] = useState("");
  const [pubDeliverables, setPubDeliverables] = useState("");
  const [pubRequiredFiles, setPubRequiredFiles] = useState("");  // Phase 2: glob patterns
  const [pubRubric, setPubRubric] = useState("");
  const [pubDeadline, setPubDeadline] = useState("");
  const [pubChallengeType, setPubChallengeType] = useState("build");  // Phase 3
  const [pubDimensions, setPubDimensions] = useState<Array<{id:string;label:string;weight:number;signals:string;negativeSignals:string}>>([]);  // Phase 3
  const [pubLoading, setPubLoading] = useState(false);
  const [pubResult, setPubResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Phase 3: Default dimension templates per challenge type
  const TYPE_DEFAULTS: Record<string, Array<{id:string;label:string;weight:number;signals:string;negativeSignals:string}>> = {
    build: [
      { id:"problemUnderstanding", label:"问题理解", weight:15, signals:"准确定义问题,明确目标用户", negativeSignals:"跑题,理解偏差" },
      { id:"aiUsage", label:"AI使用质量", weight:20, signals:"多轮迭代,prompt优化,工作流设计", negativeSignals:"一句话指令,没有AI记录" },
      { id:"artifactCompleteness", label:"产物完整性", weight:25, signals:"README,可运行代码,安装说明", negativeSignals:"文件为空,缺交付物" },
      { id:"technicalExecution", label:"技术实现", weight:25, signals:"代码规范,Git提交,架构设计", negativeSignals:"硬编码路径,代码混乱" },
      { id:"reflectionQuality", label:"复盘质量", weight:15, signals:"具体分析,改进方案,迭代记录", negativeSignals:"敷衍,无实际反思" },
    ],
    explore: [
      { id:"explorationDepth", label:"探索深度", weight:25, signals:"多方案对比,实验记录,数据支撑", negativeSignals:"浅尝辄止,无数据" },
      { id:"aiUsage", label:"AI使用质量", weight:20, signals:"多轮迭代,prompt优化,工作流设计", negativeSignals:"一句话指令,没有AI记录" },
      { id:"methodRigor", label:"方法严谨性", weight:20, signals:"实验设计,对照实验,可复现", negativeSignals:"无方法说明" },
      { id:"discoveryValue", label:"发现价值", weight:20, signals:"新发现,反直觉结论,实用洞见", negativeSignals:"无新发现" },
      { id:"reflectionQuality", label:"复盘质量", weight:15, signals:"具体分析,改进方案,迭代记录", negativeSignals:"敷衍,无实际反思" },
    ],
    research: [
      { id:"thoughtDepth", label:"思想深度", weight:30, signals:"原创观点,深度分析,批判思维", negativeSignals:"表面总结,缺乏思考" },
      { id:"structureRigor", label:"结构严谨性", weight:25, signals:"逻辑清晰,引用规范,论证充分", negativeSignals:"结构混乱,缺少引用" },
      { id:"publishability", label:"可发表性", weight:20, signals:"学术规范,创新贡献,写作质量", negativeSignals:"像笔记不像论文" },
      { id:"aiUsage", label:"AI使用质量", weight:15, signals:"AI辅助研究,迭代优化", negativeSignals:"未使用AI或滥用" },
      { id:"attribution", label:"拿来主义", weight:10, signals:"外部资源利用,改造说明,来源标注", negativeSignals:"无来源标注,照搬" },
    ],
    product: [
      { id:"productCompleteness", label:"产品完成度", weight:30, signals:"核心功能,可运行,无重大bug", negativeSignals:"不能运行,功能残缺" },
      { id:"ux", label:"用户体验", weight:20, signals:"界面设计,交互流畅,易上手", negativeSignals:"无法使用,界面混乱" },
      { id:"technicalExecution", label:"技术实现", weight:20, signals:"代码规范,架构设计,可部署", negativeSignals:"硬编码,无法部署" },
      { id:"aiUsage", label:"AI使用质量", weight:15, signals:"AI辅助开发,迭代记录", negativeSignals:"无AI使用记录" },
      { id:"documentation", label:"文档质量", weight:15, signals:"README,使用说明,API文档", negativeSignals:"无文档" },
    ],
  };

  // Review modal
  const [reviewTarget, setReviewTarget] = useState<SubmissionRow | null>(null);
  const [reviewScore, setReviewScore] = useState(80);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [reviewAiEval, setReviewAiEval] = useState<EvaluationData | null>(null);

  const [realSubmissions, setRealSubmissions] = useState<SubmissionListItem[] | null>(null);
  const [subsLoading, setSubsLoading] = useState(true);
  const [students, setStudents] = useState<StudentInfo[]>([]);

  useEffect(() => {
    fetchSubmissions().then((r) => {
      if (r.ok && r.submissions) setRealSubmissions(r.submissions);
      setSubsLoading(false);
    });
    fetchStudents().then((r) => {
      if (r.ok && r.students) setStudents(r.students);
    });
    fetchChallenges().then((r) => {
      setChallenges(r.items || []);
    });
  }, []);

  const submissions: SubmissionRow[] = (realSubmissions || []).map((s) => ({
    id: s.submission_id,
    studentName: s.student_name,
    studentId: s.student_id,
    challengeId: s.challenge_id || "",
    challengeTitle: s.project_title,
    githubRepo: s.github_repo_url?.replace(/^https?:\/\/github\.com\//, "") || "",
    githubRepoUrl: s.github_repo_url || "",
    submittedAt: s.submitted_at || "",
    aiScore: s.score_total || 0,
    status: (() => {
      const st = s.status || "";
      if (st === "accepted" || st === "reviewed") return "已评分";
      if (st === "pending_review" || st === "under_review" || st === "pending_teacher_review") return "待评审";
      if (st === "needs_revision" || st === "needs_teacher_revision") return "检查失败";
      if (st === "checking" || st === "validating") return "检查中";
      return "已提交";
    })(),
  }));

  // Filter submissions
  const filteredSubs = submissions.filter((s) => {
    const matchesSearch = s.studentName.includes(search) || s.challengeTitle.includes(search) || s.githubRepo.includes(search);
    const matchesStatus = !statusFilter || s.status === statusFilter;
    const matchesChallenge = !selectedChallenge || s.challengeId === selectedChallenge;
    return matchesSearch && matchesStatus && matchesChallenge;
  });

  // Challenge stats
  const challengeStats = challenges.map((c) => {
    const subs = submissions.filter((s) => s.challengeId === c.id);
    const reviewed = subs.filter((s) => s.status === "已评分");
    const avgScore = reviewed.length > 0 ? Math.round(reviewed.reduce((a, s) => a + s.aiScore, 0) / reviewed.length) : 0;
    const pending = subs.filter((s) => s.status === "待评审").length;
    return { challenge: c, totalSubs: subs.length, reviewed: reviewed.length, pending, avgScore };
  });

  const totalStudents = students.length;
  const totalSubmissions = submissions.length;
  const reviewedCount = submissions.filter((s) => s.status === "已评分").length;
  const pendingCount = submissions.filter((s) => s.status === "待评审").length;

  // Review actions
  const handleReview = async (action: "accept" | "return") => {
    if (!reviewTarget) return;
    setReviewLoading(true);
    setReviewResult(null);
    try {
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: reviewTarget.id,
          action,
          score: reviewScore,
          feedback: reviewFeedback || (action === "accept" ? "通过" : "需要修改"),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setReviewResult({ ok: true, message: `${action === "accept" ? "确认通过" : "打回修改"}成功` });
        setReviewTarget(null);
        setReviewFeedback("");
        fetchSubmissions().then((r) => {
          if (r.ok && r.submissions) setRealSubmissions(r.submissions);
        });
      } else {
        setReviewResult({ ok: false, message: data.error || "操作失败" });
      }
    } catch {
      setReviewResult({ ok: false, message: "网络错误" });
    }
    setReviewLoading(false);
  };

  const handlePublish = async () => {
    setPubLoading(true);
    setPubResult(null);
    try {
      // Phase 3: build rubric_dimensions from dimension table
      const rubricDimensions = pubDimensions.length > 0 ? JSON.stringify({
        dimensions: pubDimensions.map(d => ({
          id: d.id, label: d.label, weight: d.weight, maxPoints: d.weight,
          description: d.label,
          signals: d.signals.split(/[,，]/).map(s => s.trim()).filter(Boolean),
          negativeSignals: d.negativeSignals.split(/[,，]/).map(s => s.trim()).filter(Boolean),
        })),
        totalPoints: 100,
      }) : undefined;

      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: pubTitle, brief: pubBrief, objective: pubObjective, deliverables: pubDeliverables, rubric: pubRubric, required_deliverables: pubRequiredFiles, rubric_dimensions: rubricDimensions, deadline: pubDeadline }),
      });
      const data = await res.json();
      setPubResult(data.ok
        ? { ok: true, message: `Challenge 发布成功！ID: ${data.challengeId}` }
        : { ok: false, message: data.missingFields ? `缺少：${data.missingFields.join("、")}` : data.error || "发布失败" }
      );
      if (data.ok) { setPubTitle(""); setPubBrief(""); setPubObjective(""); setPubDeliverables(""); setPubRequiredFiles(""); setPubRubric(""); setPubDeadline(""); setPubDimensions([]); }
    } catch {
      setPubResult({ ok: false, message: "网络错误" });
    }
    setPubLoading(false);
  };

  // C06: Export CSV
  const handleExportCSV = () => {
    const rows = [["学生姓名","学生ID","挑战名称","GitHub仓库","提交时间","AI评分","最终评分","状态"]];
    filteredSubs.forEach((s) => {
      rows.push([s.studentName, s.studentId, s.challengeTitle, s.githubRepoUrl, s.submittedAt, String(s.aiScore), "", s.status]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nseap-submissions-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">教师控制台</h1>
          <p className="mt-1 text-sm text-gray-500">查看全班提交进度，管理评审流程</p>
        </div>
        <button onClick={handleExportCSV} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <Download className="h-4 w-4" /> 导出 Excel
        </button>
      </div>

      {/* 发布 Challenge */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">发布新 Challenge</h3>
            <p className="mt-1 text-sm text-gray-500">创建一个新的挑战任务，发布后学生即可开始提交</p>
          </div>
          <button onClick={() => { setShowPublishForm(!showPublishForm); setPubResult(null); }}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            {showPublishForm ? "收起" : "发布新 Challenge"}
          </button>
        </div>
        {showPublishForm && (
          <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
            <div><label className="block text-sm font-medium text-gray-900">标题 *</label>
              <input type="text" value={pubTitle} onChange={(e) => setPubTitle(e.target.value)} placeholder="例如：构建一个 AI 客服机器人" className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-900">简介</label>
              <textarea value={pubBrief} onChange={(e) => setPubBrief(e.target.value)} rows={2} placeholder="一两句话介绍" className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-900">目标</label>
              <textarea value={pubObjective} onChange={(e) => setPubObjective(e.target.value)} rows={2} placeholder="学生学到什么" className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-900">交付物 *</label>
              <textarea value={pubDeliverables} onChange={(e) => setPubDeliverables(e.target.value)} rows={2} placeholder="需要提交什么" className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-900">必交文件（glob 模式，逗号分隔）</label>
              <input type="text" value={pubRequiredFiles} onChange={(e) => setPubRequiredFiles(e.target.value)} placeholder="README.md, *.py, demo.*, *AI日志*" className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm" />
              <p className="mt-1 text-xs text-gray-400">用 * 匹配任意字符。学生仓库缺少这些文件将被直接打回。</p></div>
            <div><label className="block text-sm font-medium text-gray-900">评分标准 *</label>
              <textarea value={pubRubric} onChange={(e) => setPubRubric(e.target.value)} rows={3} placeholder="按什么标准评分" className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm" /></div>
            {/* Phase 3: Challenge type + dimensions */}
            <div><label className="block text-sm font-medium text-gray-900">Challenge 类型</label>
              <select value={pubChallengeType} onChange={(e) => { setPubChallengeType(e.target.value); setPubDimensions(TYPE_DEFAULTS[e.target.value] || []); }} className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-3 text-sm">
                <option value="build">构建型 — 代码/系统开发</option>
                <option value="explore">探索型 — 实验/调研</option>
                <option value="research">研究型 — 论文/分析</option>
                <option value="product">产品型 — 完整产品交付</option>
              </select></div>
            {pubDimensions.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">评分维度（权重合计: {pubDimensions.reduce((s,d)=>s+d.weight,0)}/100）</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="pb-1 pr-2">维度</th><th className="pb-1 pr-2 w-14">权重</th><th className="pb-1 pr-2">正面信号</th><th className="pb-1">负面信号</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pubDimensions.map((d, i) => (
                        <tr key={d.id} className="border-t border-gray-100">
                          <td className="py-1 pr-2">
                            <input className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs" value={d.label}
                              onChange={e => { const nd=[...pubDimensions]; nd[i]={...nd[i],label:e.target.value}; setPubDimensions(nd); }} />
                          </td>
                          <td className="py-1 pr-2">
                            <input type="number" min={5} max={50} className="w-14 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs" value={d.weight}
                              onChange={e => { const nd=[...pubDimensions]; nd[i]={...nd[i],weight:parseInt(e.target.value)||0}; setPubDimensions(nd); }} />
                          </td>
                          <td className="py-1 pr-2">
                            <input className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs" value={d.signals}
                              onChange={e => { const nd=[...pubDimensions]; nd[i]={...nd[i],signals:e.target.value}; setPubDimensions(nd); }} />
                          </td>
                          <td className="py-1">
                            <input className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs" value={d.negativeSignals}
                              onChange={e => { const nd=[...pubDimensions]; nd[i]={...nd[i],negativeSignals:e.target.value}; setPubDimensions(nd); }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div><label className="block text-sm font-medium text-gray-900">截止时间 *</label>
              <input type="datetime-local" value={pubDeadline} onChange={(e) => setPubDeadline(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm" /></div>
            {pubResult && <div className={`rounded-lg p-3 text-sm ${pubResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{pubResult.message}</div>}
            <button onClick={handlePublish} disabled={pubLoading} className="btn-primary">{pubLoading ? "发布中..." : "发布 Challenge"}</button>
          </div>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[{label:"学生总数",value:totalStudents,color:"blue",icon:Users},
          {label:"总提交数",value:totalSubmissions,color:"primary",icon:CheckCircle2},
          {label:"待评审",value:pendingCount,color:"amber",icon:Clock},
          {label:"已评分",value:reviewedCount,color:"green",icon:Star}].map((s,i) => (
          <div key={i} className="stat-card"><div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-500">{s.label}</p><p className={`text-2xl font-bold ${s.color==="amber"?"text-amber-600":s.color==="green"?"text-green-600":"text-gray-900"}`}>{s.value}</p></div>
            <div className={`rounded-lg p-2 ${s.color==="blue"?"bg-blue-50":s.color==="amber"?"bg-amber-50":s.color==="green"?"bg-green-50":"bg-primary-50"}`}><s.icon className={`h-5 w-5 ${s.color==="blue"?"text-blue-600":s.color==="amber"?"text-amber-600":s.color==="green"?"text-green-600":"text-primary-600"}`} /></div>
          </div></div>
        ))}
      </div>

      {/* C04: 挑战概览表 */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">挑战概览</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">挑战名称</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">已提交/总人数</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">待评审</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">平均分</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className={`hover:bg-gray-50 cursor-pointer ${!selectedChallenge ? "bg-primary-50" : ""}`}
                onClick={() => setSelectedChallenge(null)}>
                <td className="px-5 py-3 font-medium text-gray-900">全部挑战</td>
                <td className="px-5 py-3 text-center text-gray-500">{totalSubmissions}/{totalStudents}</td>
                <td className="px-5 py-3 text-center text-gray-500">{pendingCount}</td>
                <td className="px-5 py-3 text-center text-gray-500">—</td>
                <td className="px-5 py-3 text-center"><span className="text-xs text-primary-600">当前</span></td>
              </tr>
              {challengeStats.map((cs) => (
                <tr key={cs.challenge.id}
                  className={`hover:bg-gray-50 cursor-pointer ${selectedChallenge === cs.challenge.id ? "bg-primary-50" : ""}`}
                  onClick={() => setSelectedChallenge(cs.challenge.id === selectedChallenge ? null : cs.challenge.id)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">{cs.challenge.number || cs.challenge.id}</span>
                      <span className="font-medium text-gray-900">{cs.challenge.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center text-gray-700">{cs.totalSubs}/{totalStudents}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={cs.pending > 0 ? "font-medium text-amber-600" : "text-gray-400"}>{cs.pending}</span>
                  </td>
                  <td className="px-5 py-3 text-center text-gray-700">{cs.avgScore || "—"}</td>
                  <td className="px-5 py-3 text-center">
                    {cs.challenge.github_repo ? (
                      <a href={cs.challenge.github_repo} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-700 transition-colors"
                        onClick={(e) => e.stopPropagation()} title="查看挑战资料">
                        <Github className="h-4 w-4" />
                      </a>
                    ) : (
                      <Eye className="inline h-4 w-4 text-gray-400" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="搜索学生、挑战、仓库..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          {[null, "已提交", "检查中", "检查失败", "待评审", "已评分"].map((s) => (
            <button key={s || "all"} onClick={() => setStatusFilter(s)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${statusFilter === s ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
              {s || "全部"}
            </button>
          ))}
        </div>
      </div>

      {/* 提交表格 */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">学生</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Challenge</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">仓库</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">提交时间</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI 评分</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSubs.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">{sub.studentName.charAt(0)}</div><span className="font-medium text-gray-900">{sub.studentName}</span></div></td>
                  <td className="px-5 py-4 text-gray-700">{sub.challengeTitle}</td>
                  <td className="px-5 py-4">
                    {sub.githubRepoUrl ? (
                      <a href={sub.githubRepoUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-xs flex items-center gap-1">
                        <Github className="h-3 w-3" />{sub.githubRepo}
                      </a>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{formatDateShort(sub.submittedAt)}</td>
                  <td className="px-5 py-4">{sub.aiScore > 0 ? <span className={`font-medium ${sub.aiScore >= 80 ? "text-green-600" : sub.aiScore >= 60 ? "text-amber-600" : "text-red-600"}`}>{sub.aiScore}</span> : <span className="text-gray-400">-</span>}</td>
                  <td className="px-5 py-4"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sub.status === "已评分" ? "bg-green-50 text-green-700" : sub.status === "待评审" ? "bg-purple-50 text-purple-700" : sub.status === "检查失败" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{sub.status}</span></td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { 
                        setReviewTarget(sub); 
                        setReviewResult(null);
                        setReviewAiEval(null);
                        fetchSubmissionById(sub.id).then(r => {
                          if (r.ok && r.evaluation) setReviewAiEval(r.evaluation);
                        });
                      }}
                        className="rounded bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-200">批改</button>
                      <Link href={`/submissions/${sub.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">详情<ChevronRight className="h-3 w-3" /></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {subsLoading && <div className="py-8 text-center text-sm text-gray-400">加载中...</div>}
        {!subsLoading && filteredSubs.length === 0 && <div className="py-8 text-center text-sm text-gray-400">暂无提交记录</div>}
      </div>

      {/* C05: Review modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-gray-900">批改: {reviewTarget.studentName} — {reviewTarget.challengeTitle}</h3>

            {/* GitHub link */}
            {reviewTarget.githubRepoUrl && (
              <div className="mt-2 flex items-center gap-1.5 text-sm">
                <Github className="h-4 w-4 text-gray-400" />
                <a href={reviewTarget.githubRepoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-primary-600 hover:underline truncate">{reviewTarget.githubRepo}</a>
              </div>
            )}

            {/* AI score */}
            {reviewTarget.aiScore > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                AI 初评: {reviewTarget.aiScore}分
              </div>
            )}

            {/* AI evaluation details for teacher reference */}
            {reviewAiEval && (
              <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50/50 p-3">
                <p className="text-xs font-medium text-purple-700 mb-2">AI 评审参考</p>
                {reviewAiEval.feedback && <p className="text-xs text-purple-800 mb-2">{reviewAiEval.feedback}</p>}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {reviewAiEval.strengths && (
                    <div className="rounded bg-green-100/50 p-2">
                      <span className="font-medium text-green-700">优点</span>
                      <p className="text-green-800 mt-0.5">{reviewAiEval.strengths}</p>
                    </div>
                  )}
                  {reviewAiEval.weaknesses && (
                    <div className="rounded bg-amber-100/50 p-2">
                      <span className="font-medium text-amber-700">不足</span>
                      <p className="text-amber-800 mt-0.5">{reviewAiEval.weaknesses}</p>
                    </div>
                  )}
                  {reviewAiEval.suggestions && (
                    <div className="rounded bg-blue-100/50 p-2">
                      <span className="font-medium text-blue-700">建议</span>
                      <p className="text-blue-800 mt-0.5">{reviewAiEval.suggestions}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900">分数 (0-100)</label>
                <input type="number" min={0} max={100} value={reviewScore} onChange={(e) => setReviewScore(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">评语</label>
                <textarea value={reviewFeedback} onChange={(e) => setReviewFeedback(e.target.value)} rows={3}
                  placeholder="对学生作品的评价..." className="mt-1 w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm" />
              </div>
              {reviewResult && <div className={`rounded-lg p-3 text-sm ${reviewResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{reviewResult.message}</div>}
              <div className="flex gap-3">
                <button onClick={() => handleReview("accept")} disabled={reviewLoading}
                  className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">确认通过 ✓</button>
                <button onClick={() => handleReview("return")} disabled={reviewLoading}
                  className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">退回修改 ✗</button>
              </div>
              <button onClick={() => { setReviewTarget(null); setReviewResult(null); }}
                className="w-full rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
