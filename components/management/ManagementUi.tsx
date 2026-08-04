import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export const directionLabels: Record<string, string> = {
  business_analysis: "商业分析",
  data_analysis: "数据分析",
  quant: "量化",
};

export const taskStatusLabels: Record<string, string> = {
  draft: "草稿",
  assigned: "已分配",
  in_progress: "进行中",
  submitted: "待验收",
  returned: "已退回",
  accepted: "已通过",
  cancelled: "已取消",
};

export const riskLabels: Record<string, string> = {
  normal: "正常",
  due_soon: "即将到期",
  overdue: "已逾期",
  repeated_return: "连续退回",
  no_progress: "七天无进展",
  risk: "有风险",
};

export function MetricCard({ href, label, value, hint, icon: Icon, tone = "indigo" }: {
  href: string;
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: "indigo" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <Link href={href} className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        </div>
        <span className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      </div>
    </Link>
  );
}

export function ProgressBar({ value, tone = "bg-primary-500" }: { value: number; tone?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function TaskStatusBadge({ status }: { status?: string }) {
  const accepted = status === "accepted";
  const returned = status === "returned";
  const submitted = status === "submitted";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${accepted ? "bg-emerald-50 text-emerald-700" : returned ? "bg-rose-50 text-rose-700" : submitted ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
      {taskStatusLabels[status || ""] || status || "未开始"}
    </span>
  );
}

export function LoadingState({ text = "正在加载..." }: { text?: string }) {
  return <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500">{text}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{message}</div>;
}
