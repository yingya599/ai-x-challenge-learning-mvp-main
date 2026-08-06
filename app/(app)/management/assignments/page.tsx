"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserRoundCog } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/management/ManagementUi";

type Intern = { student_id: string; name: string; department?: string; position?: string; mentor_id: string };
type Mentor = { teacher_id: string; name: string };

export default function MentorAssignmentsPage() {
  const [interns, setInterns] = useState<Intern[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const response = await fetch("/api/management/assignments");
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "加载失败");
    setInterns(payload.interns || []);
    setMentors(payload.mentors || []);
    setDrafts(Object.fromEntries((payload.interns || []).map((item: Intern) => [item.student_id, item.mentor_id || ""])));
  };

  useEffect(() => { load().catch((reason) => setError(reason instanceof Error ? reason.message : "加载失败")).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => interns.filter((item) => `${item.name} ${item.student_id} ${item.department || ""} ${item.position || ""}`.toLowerCase().includes(search.toLowerCase())), [interns, search]);

  const save = async (intern: Intern) => {
    const mentorId = drafts[intern.student_id];
    if (!mentorId) { setNotice("请先选择带教"); return; }
    setSaving(intern.student_id); setNotice("");
    const response = await fetch("/api/management/assignments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_id: intern.student_id, mentor_id: mentorId }) });
    const payload = await response.json();
    setSaving("");
    if (!response.ok) { setNotice(payload.error || "保存失败"); return; }
    setInterns((current) => current.map((item) => item.student_id === intern.student_id ? { ...item, mentor_id: mentorId } : item));
    setNotice(`已将 ${intern.name} 分配给 ${payload.mentor_name}`);
  };

  if (error) return <ErrorState message={error} />;
  if (loading) return <LoadingState text="正在加载实习生与带教关系..." />;
  return <div className="space-y-6">
    <div><p className="text-sm font-medium text-primary-600">领导配置</p><h1 className="mt-1 text-2xl font-bold text-gray-900">带教分配</h1><p className="mt-1 text-sm text-gray-500">为每名实习生指定唯一负责带教。保存后，该实习生会立即出现在对应带教的工作台中。</p></div>
    <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索实习生、部门或岗位..." /></div>
    {notice && <div className={`rounded-xl px-4 py-3 text-sm ${notice.startsWith("已将") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{notice}</div>}
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white"><table className="w-full min-w-[760px] text-sm"><thead className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500"><tr><th className="px-5 py-3">实习生</th><th className="px-5 py-3">部门 / 岗位</th><th className="px-5 py-3">负责带教</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-gray-100">{visible.map((intern) => <tr key={intern.student_id}><td className="px-5 py-4"><p className="font-medium text-gray-900">{intern.name}</p><p className="mt-1 font-mono text-xs text-gray-400">{intern.student_id}</p></td><td className="px-5 py-4"><p>{intern.position || "未填写岗位"}</p><p className="mt-1 text-xs text-gray-500">{intern.department || "未填写部门"}</p></td><td className="px-5 py-4"><select className="input max-w-xs" value={drafts[intern.student_id] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [intern.student_id]: event.target.value }))}><option value="">请选择带教</option>{mentors.map((mentor) => <option key={mentor.teacher_id} value={mentor.teacher_id}>{mentor.name}</option>)}</select></td><td className="px-5 py-4 text-right"><button disabled={saving === intern.student_id || !drafts[intern.student_id] || drafts[intern.student_id] === intern.mentor_id} onClick={() => void save(intern)} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"><UserRoundCog className="h-4 w-4" />{saving === intern.student_id ? "保存中" : "保存分配"}</button></td></tr>)}</tbody></table>{!visible.length && <div className="py-12 text-center text-sm text-gray-400">没有符合条件的实习生</div>}</div>
  </div>;
}
