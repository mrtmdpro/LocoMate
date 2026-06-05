import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { experiences } from "@/server/db/schema";
import { ACCESS_COOKIE, readCookie } from "@/server/lib/auth-cookies";
import { verifyToken } from "@/server/middleware/auth";
import { rateLimit } from "@/server/services/chat-ratelimit";

export const runtime = "nodejs";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const auth = request.headers.get("authorization") ?? "";
        const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const token =
          bearer || readCookie(request.headers.get("cookie"), ACCESS_COOKIE) || "";
        if (!token) {
          throw new Error("Unauthorized");
        }

        const payload = verifyToken(token);
        if (payload.role !== "host" && payload.role !== "admin") {
          throw new Error("Unauthorized");
        }
        const parsedPayload = parseUploadClientPayload(clientPayload);
        if (!parsedPayload?.experienceId) {
          throw new Error("Missing experienceId");
        }
        const experience = await db.query.experiences.findFirst({
          where: eq(experiences.id, parsedPayload.experienceId),
        });
        if (!experience || (payload.role !== "admin" && experience.authorId !== payload.userId)) {
          throw new Error("Unauthorized");
        }
        await rateLimit({ key: `host-experience-upload:${payload.userId}`, limit: 30, windowSec: 60 });

        const safe = pathname.replace(/[^a-zA-Z0-9._\-/]/g, "_").slice(0, 140);
        return {
          allowedContentTypes: [...ALLOWED_TYPES],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId: payload.userId,
            pathname: safe,
            clientPayload: parsedPayload,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("host experience upload completed", {
          url: blob.url,
          tokenPayload,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const isAuthError = /unauthorized/i.test(message);
    return NextResponse.json(
      { error: message },
      { status: isAuthError ? 401 : 400 },
    );
  }
}

function parseUploadClientPayload(value: string | null | undefined): { experienceId?: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { experienceId?: unknown };
    return typeof parsed.experienceId === "string"
      ? { experienceId: parsed.experienceId }
      : null;
  } catch {
    return null;
  }
}
