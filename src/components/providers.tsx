"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { ThemeProvider } from "next-themes";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import {
  authLink,
  getLegacyAccessToken,
  clearLegacyTokens,
} from "@/lib/trpc-auth-link";

export function Providers({ children }: { children: React.ReactNode }) {
  // 401 handling lives in `authLink` below, not in TanStack Query's retry,
  // so it covers mutations (e.g. `cart.add`) and not just queries. An expired
  // access token now triggers a silent cookie-based `auth.refreshToken` retry
  // before any user-visible failure. See lib/trpc-auth-link.ts.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
      },
    },
  }));

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        authLink,
        httpLink({
          url: "/api/trpc",
          // `credentials: "include"` carries the httpOnly auth cookies on every
          // request. The legacy localStorage token (pre-Cluster-C devices) is
          // attached as a transitional Bearer so the server can upgrade the
          // session to cookies on the first authenticated call.
          fetch(url, options) {
            return fetch(url, { ...options, credentials: "include" });
          },
          headers() {
            const legacy = getLegacyAccessToken();
            return legacy ? { authorization: `Bearer ${legacy}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap />
        {/* `enableSystem={false}` because Locomate explicitly ships two
         * branded modes — "Nắng Sớm Tràng An" (light) and "Đêm Sâu Phố Cổ"
         * (dark). Following the OS would silently break the brand promise
         * for users with dark-mode default OS preferences who landed here
         * expecting the warm cream wash. The toggle is the source of truth.
         * `disableTransitionOnChange` prevents the cream→forest cross-fade
         * from flashing colours on element boundaries during the swap. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
          storageKey="locomate-theme"
        >
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

/**
 * Hydrates the auth store from the httpOnly session on first mount via
 * `auth.me`. When a legacy localStorage token is still present, that call
 * carries it as a Bearer (see the httpLink headers above) so the server mints
 * cookies; we then strip the localStorage tokens so subsequent requests ride
 * on cookies only. Renders nothing.
 */
function AuthBootstrap() {
  const setUser = useAuthStore((s) => s.setUser);
  const ranRef = useRef(false);
  const me = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (ranRef.current || me.isPending) return;
    ranRef.current = true;
    if (me.data?.user) {
      setUser(me.data.user);
      // The /me call already upgraded a legacy Bearer session to cookies
      // server-side; drop the stale localStorage tokens.
      clearLegacyTokens();
    } else if (me.isSuccess) {
      // Authenticated probe returned no user: any legacy token is dead.
      clearLegacyTokens();
    }
  }, [me.isPending, me.isSuccess, me.data, setUser]);

  return null;
}
