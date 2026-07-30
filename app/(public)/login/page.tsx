"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GraduationCap, ShieldCheck, Sparkles, Users } from "lucide-react";

type LoginMode = "member" | "admin";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("member");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(mode === "admin" ? "/api/auth/admin/login" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "admin"
          ? { admin_id: userId.trim(), name: name.trim() }
          : { studentId: userId.trim(), name: name.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "登录失败");
      router.push(data.redirect || (mode === "admin" ? "/admin" : "/dashboard"));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[68vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
            <Sparkles className="h-6 w-6 text-primary-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">登录 NSEAP</h1>
          <p className="mt-1 text-sm text-gray-500">Elite20 Builder Program</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 grid grid-cols-2 rounded-lg bg-gray-100 p-1">
            <button type="button" onClick={() => { setMode("member"); setError(""); }}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${mode === "member" ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
              <Users className="h-4 w-4" /> 学生 / 教师
            </button>
            <button type="button" onClick={() => { setMode("admin"); setError(""); }}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${mode === "admin" ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
              <ShieldCheck className="h-4 w-4" /> 管理员
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900">{mode === "admin" ? "管理员 ID" : "用户 ID"}</label>
              <div className="relative mt-1">
                {mode === "admin"
                  ? <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  : <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-gray-400" />}
                <input value={userId} onChange={(event) => setUserId(event.target.value)}
                  placeholder={mode === "admin" ? "输入 admin_id" : "学生 ID 或教师 ID"}
                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900">姓名</label>
              <input value={name} onChange={(event) => setName(event.target.value)}
                placeholder="请输入飞书表中的姓名"
                className="mt-1 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" required />
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-60">
              {loading ? "正在验证…" : mode === "admin" ? "登录管理系统" : "登录学习平台"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">返回首页</a>
        </div>
      </div>
    </div>
  );
}
