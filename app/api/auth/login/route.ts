// POST /api/auth/login — Universal identity verification + session token issuance (T07)
// Checks Admins → Teachers → Students; issues HttpOnly session cookie with 24h expiry.
// Redirects student to /dashboard, teacher/admin to /teacher.
import { NextResponse } from "next/server";
import { getStudentById, getTeacherById, getAdminById, updateStudent } from "@/lib/server/feishu";
import { signToken, determineRole, SESSION_COOKIE } from "@/lib/server/principal";
import { generateApiKey } from "@/lib/server/agent-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const personId = String(body.studentId ?? body.userId ?? "").trim();
    const name = String(body.name ?? "").trim();

    if (!personId || !name) {
      return NextResponse.json(
        { ok: false, error: "请填写ID和姓名" },
        { status: 400 },
      );
    }

    // T07: Universal login — try Admins → Teachers → Students
    let identity: { name: string; class_id?: string; api_key?: string; recordId?: string } | null = null;
    let lookupTable = "";

    // 1. Try Admins
    try {
      const admin = await getAdminById(personId);
      if (admin) {
        identity = admin;
        lookupTable = "admins";
      }
    } catch (err) { console.warn("[login] lookup failed:", err instanceof Error ? err.message : String(err)); }

    // 2. Try Teachers
    if (!identity) {
      try {
        const teacher = await getTeacherById(personId);
        if (teacher) {
          identity = teacher;
          lookupTable = "teachers";
        }
      } catch (err) { console.warn("[login] lookup failed:", err instanceof Error ? err.message : String(err)); }
    }

    // 3. Try Students
    if (!identity) {
      try {
        const student = await getStudentById(personId);
        identity = student;
        lookupTable = "students";
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("not found") || msg.includes("Student not found")) {
          // Not in any Feishu table — check TEACHER_IDS env var as last resort
          const teacherIds = (process.env.TEACHER_IDS || "")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          if (teacherIds.includes(personId.toLowerCase())) {
            // Accept login with provided name; role will be determined by determineRole()
            identity = { name }; // trust the name they typed
            lookupTable = "env";
          } else {
            return NextResponse.json(
              { ok: false, error: "ID不存在或未导入系统" },
              { status: 401 },
            );
          }
        } else {
          console.error("[login] lookup error:", msg);
          return NextResponse.json(
            { ok: false, error: "系统暂时无法验证身份，请稍后重试" },
            { status: 503 },
          );
        }
      }
    }

    // Name check
    if (identity.name.trim().toLowerCase() !== name.toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: "姓名不匹配" },
        { status: 401 },
      );
    }

    // Auto-generate API key for students on first login
    let apiKey: string | undefined;
    if (lookupTable === "students" && identity.recordId && !identity.api_key) {
      apiKey = generateApiKey();
      await updateStudent(identity.recordId, { api_key: apiKey }).catch((err) => {
        console.warn("[login] Failed to save API key:", err instanceof Error ? err.message : String(err));
      });
    }

    // Determine role
    const role = await determineRole(personId);

    // Sign session token
    const token = signToken({
      person: personId,
      org: "elite20",
      role,
      name: identity.name,
    });

    // T07: Determine redirect based on role
    if (role === "admin") {
      return NextResponse.json(
        { ok: false, error: "管理员必须使用飞书 OAuth 登录", code: "ADMIN_OAUTH_REQUIRED" },
        { status: 403 },
      );
    }
    const redirect = role === "student" ? "/dashboard" : "/teacher";

    const response = NextResponse.json({
      ok: true,
      person: personId,
      role,
      name: identity.name,
      class_id: identity.class_id || "",
      redirect,
      // T07: api_key NOT returned in login response
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24h
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "登录失败" },
      { status: 500 },
    );
  }
}
