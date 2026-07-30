// Next.js instrumentation — starts Redis Stream consumers on server boot (T19).
// Only runs in Node.js runtime (server-side), not in Edge or browser.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initMessageBus } = await import("@/lib/server/init-bus");
    await initMessageBus();
  }
}
