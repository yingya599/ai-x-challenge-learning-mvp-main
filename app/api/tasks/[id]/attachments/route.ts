import { NextResponse } from "next/server";
import { getPrincipal, getStudentId } from "@/lib/server/principal";
import { uploadFeishuAttachment } from "@/lib/server/feishu";
import { getVisibleTasks } from "@/lib/server/task-platform";
import type { EvidenceType } from "@/lib/server/types";

function evidenceType(file: File): EvidenceType {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (["xls", "xlsx", "csv"].includes(extension)) return "spreadsheet";
  if (["ppt", "pptx", "key"].includes(extension)) return "presentation";
  if (["zip", "tar", "gz", "py", "js", "ts", "ipynb"].includes(extension)) return "other";
  return "document";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  const studentId = getStudentId(principal);
  if (!studentId) return NextResponse.json({ ok: false, error: "只有实习生可以上传任务附件" }, { status: 403 });
  try {
    const { id } = await params;
    const task = (await getVisibleTasks(principal)).find((item) => item.task_id === id && item.student_id === studentId);
    if (!task) return NextResponse.json({ ok: false, error: "任务不存在或不属于当前实习生" }, { status: 404 });
    if (["accepted", "cancelled"].includes(task.status || "")) return NextResponse.json({ ok: false, error: "该任务已经结束，不能上传文件" }, { status: 409 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "请选择要上传的文件" }, { status: 400 });
    const forbidden = [".exe", ".msi", ".bat", ".cmd", ".ps1", ".scr"];
    if (forbidden.some((suffix) => file.name.toLowerCase().endsWith(suffix))) {
      return NextResponse.json({ ok: false, error: "不支持上传可执行文件或脚本安装包" }, { status: 400 });
    }
    const uploaded = await uploadFeishuAttachment(file);
    return NextResponse.json({ ok: true, file: { ...uploaded, evidence_type: evidenceType(file) } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "文件上传失败" }, { status: 500 });
  }
}
