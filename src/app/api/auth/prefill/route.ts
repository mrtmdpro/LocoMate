import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-shot reader for the oauth_prefill_email cookie set when a Google sign-in
// is blocked by the conditional-linking rule. Returning the email in a JSON
// response (not a URL) avoids leaking it to Referer headers / access logs.
export async function GET() {
  const jar = await cookies();
  const email = jar.get("oauth_prefill_email")?.value ?? null;
  if (email) {
    jar.set("oauth_prefill_email", "", { path: "/", maxAge: 0 });
  }
  return Response.json({ email });
}
