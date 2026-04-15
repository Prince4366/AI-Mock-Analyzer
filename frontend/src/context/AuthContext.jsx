import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, clearToken, getToken, setToken } from "../api/client";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest("/auth/me");
      setUser(data.user);
    } catch (err) {
      clearToken();
      setUser(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const signup = useCallback(async (payload) => {
    setError("");
    const data = await apiRequest("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(async (payload) => {
    setError("");
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      clearToken();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: Boolean(user),
      signup,
      login,
      logout,
      refreshUser
    }),
    [user, loading, error, signup, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
