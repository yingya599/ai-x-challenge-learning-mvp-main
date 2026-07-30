// notify.ts — Feishu Bot notification bridge (§6.4 notification boundary)
// Supports per-student bots: if a student has configured their own Feishu Bot,
// notifications go through their bot; otherwise falls back to system bot.
import { requireEnv, optionalEnv } from "./env";
import * as feishu from "./feishu";

// ---- Token cache (per app_id) ----

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getTenantToken(appId: string, appSecret: string): Promise<string> {
  const key = appId;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const resp = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
  );

  const payload = await resp.json();
  if (!resp.ok || payload.code !== 0) {
    throw new Error(`Feishu token failed: ${payload.msg || resp.statusText}`);
  }

  tokenCache.set(key, {
    token: payload.tenant_access_token,
    expiresAt: Date.now() + Math.max(1, payload.expire - 120) * 1000,
  });
  return tokenCache.get(key)!.token;
}

interface BotCredentials {
  appId: string;
  appSecret: string;
}

async function sendImMessage(
  receiveIdType: "open_id" | "chat_id",
  receiveId: string,
  text: string,
  bot?: BotCredentials,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const appId = bot?.appId || requireEnv("FEISHU_APP_ID");
    const appSecret = bot?.appSecret || requireEnv("FEISHU_APP_SECRET");
    const token = await getTenantToken(appId, appSecret);

    const contentStr = JSON.stringify({ text });
    const bodyObj = {
      receive_id: receiveId,
      msg_type: "text",
      content: contentStr,
    };
    console.log(`[notify] sending to ${receiveId} via ${bot ? "自有Bot" : "系统Bot"} appId=${appId.substring(0,10)}...`);
    console.log(`[notify] content=${contentStr.substring(0,80)}`);

    const resp = await fetch(
      "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyObj),
      },
    );

    const payload = await resp.json();
    if (resp.ok && payload.code === 0) {
      return { ok: true };
    }
    console.warn(`[notify] sendImMessage failed: code=${payload.code} msg=${payload.msg} http=${resp.status}`);
    return { ok: false, error: payload.msg || resp.statusText };
  } catch (err) {
    console.warn("[notify] sendImMessage failed:", err instanceof Error ? err.message : String(err));
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send a DM to a student. Uses the student's own Feishu Bot if configured,
 * otherwise falls back to the system bot (FEISHU_APP_ID env var).
 */
export async function notifyStudent(
  studentId: string,
  text: string,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  try {
    const student = await feishu.getStudentById(studentId);
    if (!student.feishu_open_id) {
      console.warn(`[notify] Student ${studentId} has no feishu_open_id — notification skipped`);
      return { ok: false, skipped: true, error: "no feishu_open_id" };
    }

    // Use student's own bot if configured
    let bot: BotCredentials | undefined;
    if (student.feishu_app_id && student.feishu_app_secret) {
      bot = { appId: student.feishu_app_id, appSecret: student.feishu_app_secret };
    }

    const result = await sendImMessage("open_id", student.feishu_open_id, text, bot);
    console.log(`[notify] Sent to ${studentId} ${bot ? "(自有Bot)" : "(系统Bot)"}: ok=${result.ok}`);
    return result;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send a message to the class group chat (always uses system bot).
 */
export async function notifyGroup(
  text: string,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const chatId = optionalEnv("FEISHU_CLASS_CHAT_ID");
  if (!chatId) {
    console.warn("[notify] FEISHU_CLASS_CHAT_ID not configured — group notification skipped");
    return { ok: false, skipped: true, error: "no chat_id" };
  }
  return await sendImMessage("chat_id", chatId, text);
}
