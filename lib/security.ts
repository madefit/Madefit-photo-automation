import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function requireCronAuth(request: NextRequest) {
  const env = getServerEnv();
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  const candidate = bearer || headerSecret;

  if (!candidate || !timingSafeEqual(candidate, env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function requireAdminAuth(request: NextRequest) {
  const env = getServerEnv();
  if (!env.DASHBOARD_AUTH_TOKEN) {
    return NextResponse.json({ ok: false, error: "Dashboard token is not configured" }, { status: 403 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const headerToken = request.headers.get("x-dashboard-token") ?? "";
  const candidate = bearer || headerToken;

  if (!candidate || !timingSafeEqual(candidate, env.DASHBOARD_AUTH_TOKEN)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function rateLimit(request: NextRequest, limit = 60, windowMs = 60000) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (entry.count >= limit) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  entry.count += 1;
  return null;
}

function encryptionKey() {
  const raw = getServerEnv().ENCRYPTION_KEY;
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return decoded;
  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) return utf8;
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(value: string) {
  const payload = Buffer.from(value, "base64");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function sha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
