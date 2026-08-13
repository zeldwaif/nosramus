/**
 * Updates Supabase Auth URL settings for production.
 * Usage:
 *   set SUPABASE_ACCESS_TOKEN=sbp_...
 *   node scripts/fix-supabase-auth.mjs
 */
const projectRef = "gnahjfohthvefqrlvjmo";
const siteUrl = "https://nosramus.vercel.app";
const redirectUrls = [
  "http://localhost:3000/**",
  "https://nosramus.vercel.app/**",
  "https://*-jacob-shi-s-projects.vercel.app/**",
].join(",");

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens"
  );
  process.exit(1);
}

const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site_url: siteUrl,
      uri_allow_list: redirectUrls,
    }),
  }
);

const body = await response.text();
if (!response.ok) {
  console.error(`Failed (${response.status}):`, body);
  process.exit(1);
}

console.log("Supabase auth URLs updated.");
console.log(JSON.stringify(JSON.parse(body), null, 2));
