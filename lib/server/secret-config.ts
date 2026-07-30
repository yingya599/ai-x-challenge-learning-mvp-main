import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getSystemConfig, setSystemConfig } from "./feishu";

const ALLOWED_SECRETS = new Set([
  "GITHUB_TOKEN", "DEEPSEEK_API_KEY", "OPENAI_API_KEY",
  "FEISHU_APP_SECRET", "FEISHU_CLASS_CHAT_ID",
]);

function encryptionKey() {
  const raw = process.env.ADMIN_CONFIG_MASTER_KEY;
  if (!raw) throw new Error("ADMIN_CONFIG_MASTER_KEY 未配置");
  return createHash("sha256").update(raw).digest();
}

export function isAllowedSecret(key: string) {
  return ALLOWED_SECRETS.has(key);
}

export async function setEncryptedSecret(key: string, value: string, actor: string) {
  if (!isAllowedSecret(key)) throw new Error("不允许管理该配置项");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const payload = {
    ciphertext: ciphertext.toString("base64"), nonce: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"), key_version: 1,
    hint: value.length > 4 ? `••••${value.slice(-4)}` : "••••",
    updated_at: new Date().toISOString(), updated_by: actor,
  };
  await setSystemConfig({ key, ...payload });
  return { key, configured: true, hint: payload.hint, updated_at: payload.updated_at };
}

export async function getSecretStatus() {
  return Promise.all([...ALLOWED_SECRETS].map(async (key) => {
    const item = await getSystemConfig(key);
    return {
      key, configured: Boolean(item || process.env[key]), source: item ? "encrypted_store" : process.env[key] ? "environment" : "missing",
      hint: item?.hint || (process.env[key] ? "••••" : ""), updated_at: item?.updated_at,
    };
  }));
}

export async function readEncryptedSecret(key: string): Promise<string | undefined> {
  const item = await getSystemConfig(key);
  if (!item) return process.env[key];
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(item.nonce, "base64"));
  decipher.setAuthTag(Buffer.from(item.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(item.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
