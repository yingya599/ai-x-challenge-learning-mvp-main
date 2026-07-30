// POST /api/auth/logout — Clear session cookie (T07)
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/principal";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // immediately expire
  });
  return response;
}
