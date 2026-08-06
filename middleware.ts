// middleware.ts — Route guard for authenticated pages (T09)
// Redirects unauthenticated users to /login, preserves the intended destination.
// Edge runtime: lightweight check only (no HMAC verification, just cookie presence).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "nseap_session";

// (app) group paths that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/submit",
  "/submissions",
  "/teacher",
  "/admin",
  "/profile",
  "/portfolio",
  "/challenges",
  "/lms",
  "/github",
  "/knowledge",
  "/docs",
  "/management",
  "/tasks",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|login|favicon|.*\\.).*)"],
};
