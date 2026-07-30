import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "crypto";
import { promisify } from "util";
import { getRedis } from "./redis";

const scrypt = promisify(scryptCallback);
const PREFIX = "nseap:admin:credentials:";
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export interface StoredAdminCredentials {
  password_hash: string;
  password_salt: string;
  totp_ciphertext: string;
  totp_nonce: string;
  totp_tag: string;
  created_at: string;
}

function masterKey() {
  const raw = process.env.ADMIN_CONFIG_MASTER_KEY;
  if (!raw) throw new Error("ADMIN_CONFIG_MASTER_KEY 未配置");
  return createHash("sha256").update(raw).digest();
}

function redisClient() {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") throw new Error("管理员认证存储不可用");
  return redis;
}

export function generateTotpSecret() {
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i < bits.length; i += 5) output += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return output;
}

function decodeBase32(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) bits += BASE32.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpAt(secret: string, counter: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return binary.toString().padStart(6, "0");
}

export function verifyTotp(secret: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const current = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((window) => {
    const expected = Buffer.from(totpAt(secret, current + window));
    const supplied = Buffer.from(code);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  });
}

export async function hashPassword(password: string, salt = randomBytes(16).toString("base64")) {
  const derived = await scrypt(password, salt, 64) as Buffer;
  return { hash: derived.toString("base64"), salt };
}

export async function verifyPassword(password: string, salt: string, hash: string) {
  const candidate = await hashPassword(password, salt);
  const a = Buffer.from(candidate.hash, "base64");
  const b = Buffer.from(hash, "base64");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function saveAdminCredentials(adminId: string, password: string, totpSecret: string) {
  const { hash, salt } = await hashPassword(password);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(totpSecret, "utf8"), cipher.final()]);
  const item: StoredAdminCredentials = {
    password_hash: hash, password_salt: salt,
    totp_ciphertext: ciphertext.toString("base64"), totp_nonce: nonce.toString("base64"),
    totp_tag: cipher.getAuthTag().toString("base64"), created_at: new Date().toISOString(),
  };
  await redisClient().set(`${PREFIX}${adminId}`, JSON.stringify(item));
}

export async function getAdminCredentials(adminId: string) {
  const raw = await redisClient().get(`${PREFIX}${adminId}`);
  if (!raw) return null;
  const item = JSON.parse(raw) as StoredAdminCredentials;
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(item.totp_nonce, "base64"));
  decipher.setAuthTag(Buffer.from(item.totp_tag, "base64"));
  const secret = Buffer.concat([decipher.update(Buffer.from(item.totp_ciphertext, "base64")), decipher.final()]).toString("utf8");
  return { item, secret };
}

export async function isAdminInitialized(adminId: string) {
  return Boolean(await redisClient().exists(`${PREFIX}${adminId}`));
}
