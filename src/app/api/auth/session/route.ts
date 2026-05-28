import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { userProfiles, users } from "@/server/db/schema";
import { verifyToken } from "@/server/middleware/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDOFF_COOKIES = ["oauth_at", "oauth_rt", "oauth_new", "oauth_return_to"];

// One-shot handoff: browser lands on /auth/complete after an OAuth callback,
// it calls GET /api/auth/session, we read the short-lived httpOnly cookies,
// clear them, and hand the JWTs to the SPA so it can put them in Zustand.
export async function GET() {
  const jar = await cookies();
  const accessToken = jar.get("oauth_at")?.value;
  const refreshToken = jar.get("oauth_rt")?.value;
  const isNew = jar.get("oauth_new")?.value === "1";
  const rawReturnTo = jar.get("oauth_return_to")?.value || "/home";
  const returnTo =
    rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/home";

  if (!accessToken || !refreshToken) {
    return Response.json(
      { error: "no_handoff" },
      { status: 400 },
    );
  }

  let userId: string;
  try {
    ({ userId } = verifyToken(accessToken));
  } catch {
    clearHandoffCookies(jar);
    return Response.json({ error: "invalid_token" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || !user.isActive) {
    clearHandoffCookies(jar);
    return Response.json({ error: "inactive" }, { status: 400 });
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, user.id),
  });

  clearHandoffCookies(jar);

  return Response.json({
    accessToken,
    refreshToken,
    isNew,
    returnTo,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      onboardingCompleted: profile?.onboardingCompleted ?? false,
    },
  });
}

function clearHandoffCookies(jar: Awaited<ReturnType<typeof cookies>>) {
  for (const name of HANDOFF_COOKIES) {
    jar.set(name, "", { path: "/", maxAge: 0 });
  }
}
