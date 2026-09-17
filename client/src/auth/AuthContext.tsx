import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { fetchMe, logout as apiLogout } from "@/api/auth";
import type { SessionUser } from "@/api/types";

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  // isAdmin wird genau hier einmal abgeleitet, damit kein Verbraucher das nachbaut.
  return (
    <AuthContext.Provider value={{ user, loading, isAdmin: user?.isAdmin ?? false, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth muss innerhalb von AuthProvider verwendet werden");
  return context;
}
