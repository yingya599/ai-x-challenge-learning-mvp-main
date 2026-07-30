// POST /api/auth/api-key — Generate/rotate API key (T08)
// New key immediately invalidates the old one. Plaintext returned ONLY ONCE.
import { NextResponse } from "next/server";
import { getPrincipal } from "@/lib/server/principal";
import { getStudentById, updateStudent } from "@/lib/server/feishu";
import { generateApiKey, hashApiKey } from "@/lib/server/agent-auth";

export async function POST() {
  const principal = await getPrincipal();
  if (!principal) {
    return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  }

  try {
    const student = await getStudentById(principal.person);

    const newKey = generateApiKey();
    const newHash = hashApiKey(newKey);

    const fields: Record<string, unknown> = {
      api_key: newKey,
      api_key_hash: newHash,
    };

    if (student.recordId) {
      try {
        await updateStudent(student.recordId, fields);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("1254045") || msg.includes("FieldNameNotFound") || msg.includes("field not found")) {
          console.warn("[api-key] Hash field not found, falling back to plaintext-only write");
          await updateStudent(student.recordId, { api_key: newKey });
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      api_key: newKey,
      message: "API Key 已生成，旧 Key 已失效。请立即复制保存，此密钥仅显示一次。",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found") || msg.includes("Student not found")) {
      return NextResponse.json(
        { ok: false, error: "仅学生账号可管理 API Key" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Key generation failed" },
      { status: 500 },
    );
  }
}
