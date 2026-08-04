"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileCheck2, ListTodo, Loader2 } from "lucide-react";
import { TaskStatusBadge, directionLabels } from "@/components/management/ManagementUi";
import { fetchSubmissions, type SubmissionListItem } from "@/lib/api";

type Task = { task_id: string; title: string; job_direction: string; status?: string; due_date?: string; mentor_name?: string };

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then((response) => response.json()),
      fetchSubmissions(),
    ]).then(([taskPayload, submissionPayload]) => {
      setTasks(taskPayload.ok ? taskPayload.tasks || [] : []);
      setSubmissions(submissionPayload.ok ? submissionPayload.submissions || [] : []);
    }).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => ({
    total: tasks.length,
    active: tasks.filter((task) => ["assigned", "in_progress", "returned"].includes(task.status || "assigned")).length,
    pending: submissions.filter((item) => ["pending_teacher_review", "submitted"].includes(item.status || "")).length,
    accepted: tasks.filter((task) => task.status === "accepted").length,
  }), [tasks, submissions]);

  if (loading) return <div className="flex flex-col items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /><p className="mt-3 text-sm text-gray-500">正在加载我的任务...</p></div>;

  const cards = [
    { label: "分配给我的任务", value: stats.total, icon: ListTodo, tone: "bg-primary-50 text-primary-600", href: "/tasks" },
    { label: "进行中/待修改", value: stats.active, icon: Clock3, tone: "bg-amber-50 text-amber-600", href: "/tasks" },
    { label: "等待带教验收", value: stats.pending, icon: FileCheck2, tone: "bg-blue-50 text-blue-600", href: "/submissions" },
    { label: "已验收通过", value: stats.accepted, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", href: "/tasks" },
  ];

  return <div className="space-y-6">
    <div><p className="text-sm font-medium text-primary-600">实习生工作台</p><h1 className="mt-1 text-2xl font-bold text-gray-900">我的概览</h1><p className="mt-1 text-sm text-gray-500">集中查看个人任务、提交状态、AI 初评和带教反馈。</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Link key={card.label} href={card.href} className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-primary-200 hover:shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">{card.label}</p><p className="mt-1 text-3xl font-bold text-gray-900">{card.value}</p></div><span className={`rounded-xl p-2.5 ${card.tone}`}><card.icon className="h-5 w-5" /></span></div></Link>)}</div>
    <section className="rounded-2xl border border-gray-200 bg-white"><div className="flex items-center justify-between border-b border-gray-100 px-6 py-4"><div><h2 className="font-semibold text-gray-900">最近任务</h2><p className="mt-1 text-xs text-gray-500">点击任务查看 AI 拆解、交付要求和提交入口</p></div><Link href="/tasks" className="text-sm font-medium text-primary-600">查看全部</Link></div><div className="divide-y divide-gray-100">{tasks.slice(0, 5).map((task) => <Link key={task.task_id} href={`/tasks/${encodeURIComponent(task.task_id)}`} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50"><div className="min-w-0"><p className="truncate font-medium text-gray-900">{task.title}</p><p className="mt-1 text-xs text-gray-500">{directionLabels[task.job_direction] || task.job_direction} · 带教：{task.mentor_name || "未分配"}</p></div><TaskStatusBadge status={task.status} /></Link>)}{!tasks.length && <div className="py-12 text-center text-sm text-gray-400">当前还没有分配给你的任务</div>}</div></section>
  </div>;
}
