// GET /api/platform-content — serve platform content (knowledge + docs)
// Supports remote URL via PLATFORM_CONTENT_URL env var for course swapping
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { optionalEnv } from "@/lib/server/env";

let _cachedContent: object | null = null;
let _cacheExpiry = 0;
const CACHE_TTL = 300_000; // 5 min cache

export async function GET() {
  try {
    // Return cached if fresh
    if (_cachedContent && Date.now() < _cacheExpiry) {
      return NextResponse.json(_cachedContent);
    }

    const remoteUrl = optionalEnv("PLATFORM_CONTENT_URL");

    if (remoteUrl) {
      // Fetch from remote (GitHub raw URL, etc.)
      const resp = await fetch(remoteUrl, { next: { revalidate: 300 } });
      if (!resp.ok) {
        throw new Error(`Remote content fetch failed: ${resp.status}`);
      }
      _cachedContent = await resp.json();
    } else {
      // Read local file
      const filePath = join(process.cwd(), "public", "platform-content.json");
      const raw = await readFile(filePath, "utf-8");
      _cachedContent = JSON.parse(raw);
    }

    _cacheExpiry = Date.now() + CACHE_TTL;
    return NextResponse.json(_cachedContent);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load content" },
      { status: 500 },
    );
  }
}
