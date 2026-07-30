"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, Bot, CheckCircle2, ChevronRight, CircleAlert, Database, FileClock,
  Gauge, GraduationCap, KeyRound, RefreshCw, ScrollText, Settings, ShieldCheck,
  Users, Workflow,
} from "lucide-react";

type Json = Record<string, any>;
type Tab = "overview" | "students" | "teachers" | "admins" | "challenges" | "submissions" | "approvals" | "agents" | "queue" | "audit" | "config" | "maintenance" | "diagnostics";

const tabs: Array<{ id: Tab; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "系统总览", icon: Gauge },
  { id: "students", label: "学生管理", icon: GraduationCap },
  { id: "teachers", label: "教师管理", icon: Users },
  { id: "admins", label: "管理员", icon: ShieldCheck },
  { id: "challenges", label: "挑战管理", icon: Workflow },
  { id: "submissions", label: "提交运维", icon: Database },
  { id: "approvals", label: "人工审批", icon: CheckCircle2 },
  { id: "agents", label: "Agent", icon: Bot },
  { id: "queue", label: "队列与死信", icon: FileClock },
  { id: "audit", label: "审计日志", icon: ScrollText },
  { id: "config", label: "密钥中心", icon: KeyRound },
  { id: "maintenance", label: "数据维护", icon: Settings },
  { id: "diagnostics", label: "开发诊断", icon: Activity },
];

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function Badge({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{children}</span>;
}

export default function AdminConsole() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Json | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const endpoint = useMemo(() => {
    if (["students", "teachers", "admins", "challenges"].includes(tab)) return `/api/admin/entities/${tab}`;
    if (tab === "agents") return "/api/agents";
    return `/api/admin/${tab}`;
  }, [tab]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await api(endpoint)); } catch (e) { setError(e instanceof Error ? e.message : "加载失败"); }
    finally { setLoading(false); }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
              <ShieldCheck className="h-3.5 w-3.5" /> 管理员工作台
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">NSEAP 管理控制台</h2>
            <p className="mt-2 text-sm text-gray-500">统一管理用户、教学流程、Agent 与系统运行状态</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 刷新数据
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[230px_1fr]">
        <nav className="h-fit rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${tab === item.id ? "bg-slate-950 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}>
              <item.icon className="h-4 w-4" /><span className="flex-1">{item.label}</span><ChevronRight className="h-3.5 w-3.5 opacity-40" />
            </button>
          ))}
        </nav>

        <main className="min-w-0">
          {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><CircleAlert className="h-4 w-4" />{error}</div>}
          {loading ? <Loading /> : (
            <>
              {tab === "overview" && <Overview data={data || {}} />}
              {["students", "teachers", "admins", "challenges"].includes(tab) && <EntityTable entity={tab} data={data || {}} reload={load} />}
              {tab === "approvals" && <Approvals data={data || {}} reload={load} />}
              {tab === "submissions" && <Submissions data={data || {}} reload={load} />}
              {tab === "agents" && <Agents data={data || {}} reload={load} />}
              {tab === "queue" && <Queue data={data || {}} reload={load} />}
              {tab === "audit" && <Audit data={data || {}} />}
              {tab === "config" && <Config data={data || {}} reload={load} />}
              {tab === "maintenance" && <Maintenance data={data || {}} />}
              {tab === "diagnostics" && <Diagnostics data={data || {}} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Loading() {
  return <div className="grid gap-4 md:grid-cols-3">{[1,2,3,4,5,6].map((x) => <div key={x} className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h3 className="font-semibold text-slate-900">{title}</h3></div><div className="p-5">{children}</div></section>;
}

function Overview({ data }: { data: Json }) {
  const counts = data.counts || {};
  const cards = [
    ["在读学生", counts.students, GraduationCap, "text-indigo-600 bg-indigo-50"],
    ["教师", counts.teachers, Users, "text-cyan-600 bg-cyan-50"],
    ["挑战", counts.challenges, Workflow, "text-violet-600 bg-violet-50"],
    ["累计提交", counts.submissions, Database, "text-emerald-600 bg-emerald-50"],
    ["待评审", counts.pending_reviews, FileClock, "text-amber-600 bg-amber-50"],
    ["缺少 open_id", counts.missing_open_id, CircleAlert, "text-rose-600 bg-rose-50"],
  ];
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label,value,Icon,color]) => (
      <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></div>
        <p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-semibold text-slate-950">{value ?? "—"}</p>
      </div>
    ))}</div>
    <Panel title="服务状态"><div className="grid gap-3 md:grid-cols-5">{Object.entries(data.services || {}).map(([name, service]: [string, any]) => {
      const ok = service.ok ?? service.configured; return <div key={name} className="rounded-xl bg-slate-50 p-4"><p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{name}</p><Badge ok={ok}>{ok ? "正常" : "待配置"}</Badge></div>;
    })}</div></Panel>
  </div>;
}

function EntityTable({ entity, data, reload }: { entity: string; data: Json; reload: () => void }) {
  const items = data.items || [];
  const idKey = entity === "students" ? "student_id" : entity === "teachers" ? "teacher_id" : entity === "admins" ? "admin_id" : "challenge_id";
  async function toggle(item: Json) {
    const status = item.status === "inactive" || item.status === "archived" ? "active" : entity === "challenges" ? "archived" : "inactive";
    const reason = window.prompt(`请输入将该记录设为 ${status} 的原因`);
    if (!reason) return;
    try {
      await api(`/api/admin/entities/${entity}`, { method: "PATCH", body: JSON.stringify({ record_id: item.recordId, fields: { status }, reason, request_id: crypto.randomUUID() }) });
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : "操作失败"); }
  }
  return <Panel title={`${tabs.find((x) => x.id === entity)?.label || entity} · ${items.length} 条`}>
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
      <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400"><th className="px-3 py-3">ID</th><th className="px-3 py-3">名称</th><th className="px-3 py-3">邮箱 / 描述</th><th className="px-3 py-3">Open ID</th><th className="px-3 py-3">状态</th><th className="px-3 py-3 text-right">操作</th></tr></thead>
      <tbody>{items.map((item: Json) => <tr key={item.recordId || item[idKey]} className="border-b border-slate-50 hover:bg-slate-50/70">
        <td className="px-3 py-3 font-mono text-xs text-slate-600">{item[idKey]}</td>
        <td className="px-3 py-3 font-medium text-slate-900">{item.name || item.title}</td>
        <td className="max-w-xs truncate px-3 py-3 text-slate-500">{item.email || item.brief || "—"}</td>
        <td className="px-3 py-3"><Badge ok={Boolean(item.feishu_open_id)}>{item.feishu_open_id ? "已绑定" : "未绑定"}</Badge></td>
        <td className="px-3 py-3"><Badge ok={!["inactive","archived"].includes(item.status)}>{item.status || "active"}</Badge></td>
        <td className="px-3 py-3 text-right"><button onClick={() => toggle(item)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-100">{["inactive","archived"].includes(item.status) ? "恢复" : "停用/归档"}</button></td>
      </tr>)}</tbody>
    </table></div>
  </Panel>;
}

function Approvals({ data, reload }: { data: Json; reload: () => void }) {
  const items = data.items || [];
  async function decide(item: Json, decision: string) {
    const reason = window.prompt(`请输入${decision === "approve" ? "批准" : "拒绝"}原因`); if (!reason) return;
    await api("/api/admin/approvals", { method: "POST", body: JSON.stringify({ message_id: item.envelope.message_id, decision, reason, request_id: crypto.randomUUID() }) });
    reload();
  }
  return <Panel title={`待审批请求 · ${items.length}`}>{items.length === 0 ? <Empty text="当前没有待审批请求" /> : <div className="space-y-3">{items.map((item: Json) => <div key={item.envelope.message_id} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-4"><div className="flex-1"><p className="font-medium">{item.envelope.message_type}</p><p className="mt-1 font-mono text-xs text-slate-400">{item.envelope.message_id}</p></div><button onClick={() => decide(item,"reject")} className="rounded-lg border px-3 py-2 text-sm">拒绝</button><button onClick={() => decide(item,"approve")} className="rounded-lg bg-slate-950 px-3 py-2 text-sm text-white">批准</button></div>)}</div>}</Panel>;
}

function Submissions({ data, reload }: { data: Json; reload: () => void }) {
  const items = data.items || [];
  async function recheck(item: Json) {
    const reason = prompt("请输入重新校验 GitHub 的原因"); if (!reason) return;
    try {
      await api("/api/admin/submissions", { method: "POST", body: JSON.stringify({ submission_id: item.submission_id, action: "recheck_github", reason, request_id: crypto.randomUUID() }) });
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : "校验失败"); }
  }
  return <Panel title={`提交运维 · ${items.length} 条`}><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-400"><th className="p-3">提交</th><th className="p-3">学生</th><th className="p-3">项目</th><th className="p-3">GitHub</th><th className="p-3">评审</th><th className="p-3 text-right">操作</th></tr></thead><tbody>{items.map((x: Json) => <tr key={x.submission_id} className="border-b border-slate-50"><td className="p-3 font-mono text-xs">{x.submission_id}</td><td className="p-3">{x.student_name || x.student_id}</td><td className="p-3">{x.project_title}</td><td className="p-3"><Badge ok={x.github_check_status === "passed"}>{x.github_check_status || "待校验"}</Badge></td><td className="p-3"><Badge ok={x.review_status === "accepted"}>{x.review_status || x.status}</Badge></td><td className="p-3 text-right"><button onClick={() => recheck(x)} className="rounded-lg border px-3 py-1.5 text-xs">重新校验</button></td></tr>)}</tbody></table></div></Panel>;
}

function Agents({ data, reload }: { data: Json; reload: () => void }) {
  const agents = data.agents || [];
  async function remove(id: string) { if (!confirm(`确认注销 Agent ${id}？`)) return; await api(`/api/agents/${encodeURIComponent(id)}`, { method: "DELETE" }); reload(); }
  return <Panel title={`Agent 注册表 · ${agents.length}`}>{agents.length === 0 ? <Empty text="Redis 中没有在线 Agent" /> : <div className="grid gap-3 lg:grid-cols-2">{agents.map((a: Json) => <div key={a.agent_id} className="rounded-xl border p-4"><div className="flex justify-between"><div><p className="font-medium">{a.agent_id}</p><p className="text-xs text-slate-400">{a.person} · {a.role}</p></div><Badge ok={a.status === "online"}>{a.status}</Badge></div><p className="mt-3 text-xs text-slate-500">{(a.capabilities || []).join(" · ")}</p><button onClick={() => remove(a.agent_id)} className="mt-3 text-xs text-red-600">注销 Agent</button></div>)}</div>}</Panel>;
}

function Queue({ data, reload }: { data: Json; reload: () => void }) {
  const items = data.dead_letters || [];
  async function act(id: string, action: string) { const reason = prompt("请输入操作原因"); if (!reason) return; await api("/api/admin/queue", { method: "POST", body: JSON.stringify({ id, action, reason, request_id: crypto.randomUUID() }) }); reload(); }
  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><Stat label="消息流长度" value={data.stream?.length ?? "—"} /><Stat label="死信数量（最近）" value={items.length} /></div><Panel title="死信队列">{items.length === 0 ? <Empty text="没有死信消息" /> : <div className="space-y-3">{items.map((x: Json) => <div key={x.id} className="rounded-xl border p-4"><p className="font-mono text-xs">{x.id}</p><p className="mt-2 text-sm text-red-600">{x.error}</p><div className="mt-3 flex gap-2"><button onClick={() => act(x.id,"replay")} className="rounded-lg bg-slate-950 px-3 py-2 text-xs text-white">幂等重放</button><button onClick={() => act(x.id,"ignore")} className="rounded-lg border px-3 py-2 text-xs">忽略</button></div></div>)}</div>}</Panel></div>;
}

function Audit({ data }: { data: Json }) {
  return <Panel title={`管理员审计 · ${(data.items || []).length} 条`}><div className="space-y-2">{(data.items || []).map((x: Json) => <div key={x.id} className="grid gap-2 rounded-xl border border-slate-100 p-3 text-sm md:grid-cols-[170px_140px_1fr_1fr]"><span className="text-slate-400">{new Date(x.at).toLocaleString()}</span><span className="font-medium">{x.action}</span><span>{x.target}</span><span className="text-slate-500">{x.reason}</span></div>)}{!(data.items || []).length && <Empty text="尚无管理员操作记录" />}</div></Panel>;
}

function Config({ data, reload }: { data: Json; reload: () => void }) {
  async function rotate(key: string) { const value = prompt(`输入 ${key} 新值（提交后不会再次显示）`); if (!value) return; const reason = prompt("请输入轮换原因"); if (!reason) return; await api("/api/admin/config", { method: "PUT", body: JSON.stringify({ key, value, reason, request_id: crypto.randomUUID() }) }); reload(); }
  return <div className="space-y-4">{!data.encryption_ready && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">需先在服务器配置 ADMIN_CONFIG_MASTER_KEY，才能安全写入密钥。</div>}<Panel title="密钥与集成配置"><div className="grid gap-3">{(data.items || []).map((x: Json) => <div key={x.key} className="flex items-center gap-4 rounded-xl border p-4"><KeyRound className="h-5 w-5 text-slate-400" /><div className="flex-1"><p className="font-mono text-sm font-medium">{x.key}</p><p className="mt-1 text-xs text-slate-400">{x.source} · {x.hint || "未配置"}</p></div><Badge ok={x.configured}>{x.configured ? "已配置" : "缺失"}</Badge><button disabled={!data.encryption_ready} onClick={() => rotate(x.key)} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">轮换</button></div>)}</div></Panel></div>;
}

function Diagnostics({ data }: { data: Json }) {
  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-3"><Stat label="Node Runtime" value={data.runtime?.node || "—"} /><Stat label="运行环境" value={data.runtime?.environment || "—"} /><Stat label="Redis 延迟" value={data.redis?.ok ? `${data.redis.ms} ms` : "不可用"} /></div><Panel title="飞书数据表"><div className="grid gap-3 md:grid-cols-2">{(data.feishu?.tables || []).map((x: Json) => <div key={x.name} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><code className="text-xs">{x.name}</code><Badge ok={x.configured}>{x.configured ? "已配置" : "缺失"}</Badge></div>)}</div></Panel><Panel title="集成状态"><pre className="overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-emerald-300">{JSON.stringify(data.integrations, null, 2)}</pre></Panel></div>;
}

function Maintenance({ data }: { data: Json }) {
  const issues = data.issues || [];
  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-3"><Stat label="扫描资源" value={Object.values(data.totals || {}).reduce((a: number, b: any) => a + Number(b), 0)} /><Stat label="错误" value={issues.filter((x: Json) => x.severity === "error").length} /><Stat label="警告" value={issues.filter((x: Json) => x.severity === "warning").length} /></div><Panel title="完整性扫描结果">{issues.length === 0 ? <Empty text="未发现数据完整性问题" /> : <div className="space-y-2">{issues.map((x: Json, i: number) => <div key={`${x.type}-${x.resource}-${i}`} className="flex items-center justify-between rounded-xl border p-3 text-sm"><div><p className="font-medium">{x.type}</p><p className="font-mono text-xs text-slate-400">{x.resource}</p></div><Badge ok={x.severity !== "error"}>{x.severity}</Badge></div>)}</div>}</Panel></div>;
}

function Empty({ text }: { text: string }) { return <div className="py-12 text-center text-sm text-slate-400">{text}</div>; }
function Stat({ label, value }: { label: string; value: any }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>; }
