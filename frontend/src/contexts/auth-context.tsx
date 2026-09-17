"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchAuthMe, setStoredToken, clearStoredToken } from "@/lib/api";

export interface UserProfile {
  username: string;
  roles: string[];
  isAdmin: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginUrl: string;
  login: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginUrl, setLoginUrl] = useState<string>("https://k71style.xyz/login?redirect=https://wiki.k71style.xyz");

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      // 1. Check if token is passed in URL (SSO redirect return)
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        if (urlToken) {
          setStoredToken(urlToken);
          // Remove token from query string cleanly
          params.delete("token");
          const newSearch = params.toString() ? `?${params.toString()}` : "";
          window.history.replaceState({}, "", `${window.location.pathname}${newSearch}`);
        }
      }

      const res = await fetchAuthMe();
      setLoginUrl(res.loginUrl || "https://k71style.xyz/login?redirect=https://wiki.k71style.xyz");
      
      if (res.authenticated && res.user) {
        setUser(res.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.warn("Auth check failed:", e);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
  }, [loginUrl]);

  const logout = useCallback(() => {
    clearStoredToken();
    if (typeof window !== "undefined") {
      window.location.href = "/api/auth/logout";
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        loginUrl,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
