const DEFAULT_PATH = "/chat";

/** Allow only same-app relative paths (blocks open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = DEFAULT_PATH): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
