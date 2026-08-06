import { redirect } from "next/navigation";

// 旧 Challenge 提交入口只用于历史链接兼容；新流程从个人任务详情提交。
export default function LegacySubmitPage() {
  redirect("/tasks");
}
