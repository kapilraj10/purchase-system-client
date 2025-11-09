import { createContext, useState, useEffect, useRef } from "react";
import { computeExpiry, fetchCurrentUser } from "../services/userService";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const logoutTimerRef = useRef(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        // If expired, clear immediately
        const expiresAt = parsed?.expiresAt;
        if (expiresAt && Date.now() >= Number(expiresAt)) {
          localStorage.removeItem("user");
        } else {
          setUser(parsed);
        }
      } catch {
        // corrupted storage, clear it
        localStorage.removeItem("user");
      }
    }
    setReady(true);
  }, []);

  // Clear any pending logout timer
  const clearLogoutTimer = () => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  };

  // Schedule auto-logout based on expiresAt
  const scheduleAutoLogout = (expiresAt) => {
    clearLogoutTimer();
    if (!expiresAt) return;
    const msLeft = Number(expiresAt) - Date.now();
    if (msLeft <= 0) {
      logout();
      return;
    }
    logoutTimerRef.current = setTimeout(() => {
      logout();
    }, msLeft);
  };

  const login = async (userData) => {
    // Ensure there is an expiry timestamp
    const expiresAt = userData?.expiresAt || computeExpiry(); // 1 hour from now
    const toStore = { ...userData, expiresAt };

    // Optionally hydrate role if missing and we have a token
    if (!toStore.role && toStore.token) {
      try {
        const fresh = await fetchCurrentUser(toStore.token);
        toStore.role = fresh?.role || toStore.role;
        toStore.id = toStore.id || fresh?.id || fresh?._id || fresh?.userId;
      } catch {
        // Ignore role fetch errors, user remains logged in
      }
    }

    localStorage.setItem("user", JSON.stringify(toStore));
    setUser(toStore);
    scheduleAutoLogout(expiresAt);
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
    clearLogoutTimer();
  };

  // When user changes (including initial load), schedule auto logout
  useEffect(() => {
    if (user?.expiresAt) {
      scheduleAutoLogout(user.expiresAt);
    } else {
      clearLogoutTimer();
    }
    // cleanup on unmount
    return clearLogoutTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.expiresAt]);

  return (
    <AuthContext.Provider value={{ user, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
};