/** Canonical app origin for auth redirects and absolute links. */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

/** Browser-safe origin for OAuth callbacks. */
export function getBrowserSiteUrl(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return getSiteUrl();
}
