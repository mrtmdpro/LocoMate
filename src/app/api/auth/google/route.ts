import { cookies } from "next/headers";
import { generateCodeVerifier, generateState } from "arctic";
import { googleClient } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only accept same-origin relative paths so /api/auth/google?returnTo=...
// cannot be abused as an open redirect. Anything else falls back to /home.
function sanitizeReturnTo(raw: string | null): string {
  if (!raw) return "/home";
  if (!raw.startsWith("/")) return "/home";
  if (raw.startsWith("//")) return "/home";
  return raw;
}

function appBase(): string {
  return (process.env.OAUTH_REDIRECT_BASE || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.OAUTH_REDIRECT_BASE
  ) {
    // Env vars not set (typical before first Google Cloud Console setup).
    // Send the user back to /login with a clear, non-crashing error.
    console.warn("[oauth] GOOGLE_* / OAUTH_REDIRECT_BASE env vars missing");
    return Response.redirect(`${appBase()}/login?error=not_configured`, 302);
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const authUrl = googleClient().createAuthorizationURL(state, codeVerifier, [
    "openid",
    "profile",
    "email",
  ]);

  const jar = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };
  jar.set("g_state", state, cookieOpts);
  jar.set("g_verifier", codeVerifier, cookieOpts);
  jar.set("g_return_to", returnTo, cookieOpts);

  return Response.redirect(authUrl.toString(), 302);
}
