import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import axios from "@/lib/axios";
import { debugLog, debugError } from "@/lib/debug";
import { clearTranslationCache } from "@/context/LanguageContext";

interface AuthContextType {
  loggedIn: boolean;
  login: () => void;
  logout: (redirect?: boolean) => Promise<void>;
  checkAuth: () => Promise<void>;
  authChecked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const authCheckedRef = useRef(false);
  const isCheckingRef = useRef(false);

  const login = () => {
    setLoggedIn(true);
  };

  const logout = async (redirect = true) => {
    try {
      await axios.post("/api/logout");
    } catch (error) {
      // debugError("Logout failed:", error);
    }
    setLoggedIn(false);
    // Clear any cached data
    clearTranslationCache();
    
    // Notify all components about the auth change
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:refresh'));
    }
    
    if (redirect && typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  };

  // Hard logout: Force logout with full cleanup (for ban events)
  const hardLogout = useCallback(async (reason = 'banned') => {
    debugLog('Hard logout triggered:', reason);
    
    try {
      await axios.post("/api/logout");
    } catch (error) {
      // Ignore errors
    }
    
    // Clear all state
    setLoggedIn(false);
    clearTranslationCache();
    
    // Close WebSocket by dispatching close event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('websocket:close'));
      window.dispatchEvent(new CustomEvent('auth:refresh'));
    }
    
    // Force full page redirect to clear all cached state
    if (typeof window !== 'undefined') {
      const message = reason === 'banned' ? '?banned=true' : '';
      window.location.href = `/login${message}`;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    if (authCheckedRef.current || isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;

    try {
      await axios.get("/api/me");
      setLoggedIn(true);
    } catch (err: any) {
      // 401/403 are expected when not logged in - don't log these
      if (err?.response?.status !== 401 && err?.response?.status !== 403) {
        console.error('Auth check failed:', err);
      }
      setLoggedIn(false);
    } finally {
      authCheckedRef.current = true;
      isCheckingRef.current = false;
      setAuthChecked(true);
    }
  }, []); // No dependencies - function never changes

  useEffect(() => {
    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - checkAuth is stable

  // Listen for auth refresh events (e.g., after username update, team changes)
  useEffect(() => {
    const handleAuthRefresh = () => {
      checkAuth();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:refresh', handleAuthRefresh);
      return () => {
        window.removeEventListener('auth:refresh', handleAuthRefresh);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for user-banned events from WebSocket
  useEffect(() => {
    const handleBanEvent = (event: any) => {
      debugLog('User banned event received');
      hardLogout('banned');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('user:banned', handleBanEvent);
      return () => {
        window.removeEventListener('user:banned', handleBanEvent);
      };
    }
  }, [hardLogout]);

  return (
    <AuthContext.Provider
      value={{ loggedIn, login, logout, checkAuth, authChecked }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
