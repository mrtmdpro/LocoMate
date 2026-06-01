import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatarUrl?: string | null;
  onboardingCompleted?: boolean;
}

interface AuthState {
  user: User | null;
  // Auth tokens now live in httpOnly cookies (Cluster C); they are never held
  // in JS or persisted to localStorage. The store keeps only the user profile
  // for rendering. `setAuth` is retained (single arg) so callers read cleanly.
  setAuth: (user: User) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setAuth: (user) => set({ user }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: "locomate-auth",
      // Persist only the user — never tokens. The legacy persisted shape may
      // still carry accessToken/refreshToken on existing devices; those keys
      // are simply dropped on the next write because they aren't in state.
      partialize: (state) => ({ user: state.user }),
    }
  )
);
