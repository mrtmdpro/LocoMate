"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { ThemeProvider } from "next-themes";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { authLink } from "@/lib/trpc-auth-link";

export function Providers({ children }: { children: React.ReactNode }) {
  // 401 handling lives in `authLink` below, not in TanStack Query's retry,
  // so it covers mutations (e.g. `cart.add`) and not just queries. An
  // expired access token now triggers a silent `auth.refreshToken` retry
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
          headers() {
            const token = useAuthStore.getState().accessToken;
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
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
