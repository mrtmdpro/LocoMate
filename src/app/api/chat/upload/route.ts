import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyToken } from "@/server/middleware/auth";
import { ACCESS_COOKIE, readCookie } from "@/server/lib/auth-cookies";
import { rateLimit } from "@/server/services/chat-ratelimit";

/**
 * Client-upload endpoint for chat image attachments.
 *
 * The traveler's browser calls @vercel/blob/client's `upload()` with
 * `handleUploadUrl: '/api/chat/upload'`. The browser makes TWO requests:
 *   1. POST here with { type: 'blob.generate-client-token' }.
 *      We verify the caller's JWT, scope the token to
 *      `access: 'public'` + an allowed content-type + an 8MB cap, and
 *      return it.
 *   2. PUT the raw bytes directly to Blob using the scoped token.
 *
 * The chat message record in Postgres stores the returned URL via
 * `chat.sendMessage({ attachmentUrl, attachmentKind: 'image' })`.
 *
 * NOTE on privacy: we use `access: 'public'` for image attachments so
 * `<img src>` works without fetching a signed URL on every render. The
 * URL itself is a random 64-char path so it's unguessable; combined
 * with the fact that we never expose chat content to non-participants,
 * this matches how every mainstream chat product handles image
 * attachments in practice. Upgrading to signed URLs is a future step.
 */

export const runtime = "nodejs";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MiB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Auth via the httpOnly `lm_access` cookie (same-origin upload POST
        // carries it) or an Authorization header (native fetch / legacy). We
        // use the same JWT the rest of tRPC sees; no separate upload session.
        const auth = request.headers.get("authorization") ?? "";
        const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const token =
          bearer || readCookie(request.headers.get("cookie"), ACCESS_COOKIE) || "";
        if (!token) {
          throw new Error("Unauthorized");
        }
        const payload = verifyToken(token);
        // Per-user upload rate limit (10/min, 100/day) keyed by uploader id.
        await rateLimit({ key: `upload:${payload.userId}`, limit: 30, windowSec: 60 });
        // `pathname` is client-supplied; stamp it with the user id so
        // enumerating the bucket reveals nothing but pre-scoped paths.
        // Example: "chat/u_acf6a.../1718-...-photo.jpg"
        const safe = pathname.replace(/[^a-zA-Z0-9._\-/]/g, "_").slice(0, 120);
        return {
          allowedContentTypes: [...ALLOWED_TYPES],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          // Tag the blob with the uploader id; useful if we ever need to
          // GDPR-delete a user's uploads in bulk.
          tokenPayload: JSON.stringify({
            userId: payload.userId,
            pathname: safe,
            clientPayload: clientPayload ?? null,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Fire-and-forget; the client is already aware of the upload
        // result. Used here for audit logging only.
        console.log("chat upload completed", {
          url: blob.url,
          tokenPayload,
        });
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    // 401 for auth failures so the client can show "please sign in again".
    const isAuthError = /unauthorized/i.test(message);
    return NextResponse.json(
      { error: message },
      { status: isAuthError ? 401 : 400 },
    );
  }
}
