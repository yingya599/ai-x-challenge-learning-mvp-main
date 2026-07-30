import { NextResponse } from "next/server";
import { requireAdmin, sanitizeError } from "@/lib/server/admin-auth";
import { getSubmissions, getSubmissionById, updateSubmission } from "@/lib/server/feishu";
import { checkRepoHealth } from "@/lib/server/github";
import { writeAdminAudit } from "@/lib/server/admin-audit";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const q = (new URL(request.url).searchParams.get("q") || "").toLowerCase();
  const rows = await getSubmissions();
  const items = q ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q)) : rows;
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const auth = await requireAdmin({ recentAuth: true });
  if (!auth.ok) return auth.response;
  const { submission_id, action, reason, request_id } = await request.json();
  if (!submission_id || action !== "recheck_github" || !reason) return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  try {
    const submission = await getSubmissionById(submission_id);
    if (!submission?.recordId) return NextResponse.json({ ok: false, error: "提交不存在" }, { status: 404 });
    if (!submission.github_repo_url) return NextResponse.json({ ok: false, error: "该提交没有 GitHub 仓库地址" }, { status: 400 });
    const check = await checkRepoHealth(submission.github_repo_url);
    await updateSubmission(submission.recordId, {
      github_check_status: check.repoAccessible ? "passed" : "failed",
      github_check_result: JSON.stringify(check),
      readme_found: check.readmeExists,
      latest_commit_at: check.latestCommitAt || "",
    });
    await writeAdminAudit(auth.principal, { action: "submission.recheck_github", target: submission_id, reason, result: "success", request_id });
    return NextResponse.json({ ok: true, check });
  } catch (error) {
    return NextResponse.json({ ok: false, error: sanitizeError(error) }, { status: 500 });
  }
}
