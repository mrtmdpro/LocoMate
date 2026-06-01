import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/trpc";

/**
 * CSRF baseline (Cluster C): cookies travel automatically, so a cross-site
 * page could otherwise forge a mutation. SameSite=Lax already blocks most of
 * this; we additionally reject any state-changing (non-GET) request whose
 * Origin / Referer doesn't match the deployment host. Requests without either
 * header (non-browser clients) are allowed — browsers always send Origin on
 * cross-origin POSTs, which is the case we care about.
 */
function originAllowed(req: Request): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;

  const host = req.headers.get("host");
  if (!host) return true;

  const candidate = req.headers.get("origin") ?? req.headers.get("referer");
  if (!candidate) return true;

  try {
    return new URL(candidate).host === host;
  } catch {
    return false;
  }
}

const handler = (req: Request) => {
  if (!originAllowed(req)) {
    return new Response("Forbidden: bad origin", { status: 403 });
  }

  const resHeaders = new Headers();
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ headers: req.headers, resHeaders }),
    responseMeta() {
      // Surface any Set-Cookie headers the auth procedures appended to
      // ctx.resHeaders onto the actual HTTP response. A plain record with an
      // array value keeps multiple cookies as separate Set-Cookie headers
      // (iterating a Headers object would comma-join them and corrupt both).
      const headers: Record<string, string | string[]> = {};
      const cookies = resHeaders.getSetCookie();
      if (cookies.length > 0) headers["set-cookie"] = cookies;
      return { headers };
    },
  });
};

export { handler as GET, handler as POST };
