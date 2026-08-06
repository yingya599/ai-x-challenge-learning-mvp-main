import { NextResponse } from "next/server";
import { getPrincipal, getStudentId } from "@/lib/server/principal";
import { downloadFeishuAttachment, getSubmissionById } from "@/lib/server/feishu";
import { canAccessManagement } from "@/lib/server/rbac";
import { getInternRows } from "@/lib/server/task-platform";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; token: string }> }) {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  try {
    const { id, token } = await params;
    const submission = await getSubmissionById(id);
    if (!submission) return NextResponse.json({ ok: false, error: "提交记录不存在" }, { status: 404 });
    const studentId = getStudentId(principal);
    let allowed = studentId === submission.student_id;
    if (!allowed && canAccessManagement(principal)) {
      allowed = (await getInternRows(principal)).some((student) => student.student_id === submission.student_id);
    }
    if (!allowed) return NextResponse.json({ ok: false, error: "无权下载该附件" }, { status: 403 });
    const attachment = submission.attachment_files?.find((item) => item.file_token === token);
    if (!attachment) return NextResponse.json({ ok: false, error: "附件不存在" }, { status: 404 });
    const response = await downloadFeishuAttachment(attachment);
    if (!response.ok) return NextResponse.json({ ok: false, error: "飞书附件下载失败" }, { status: 502 });
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") || attachment.type || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name || "attachment")}`,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "附件下载失败" }, { status: 500 });
  }
}
