// Authentication & user related service helpers
// -------------------------------------------------
// Assumed backend endpoints (adjust if your server differs):
//   POST   /auth/login       -> { user: {...}, token: "jwt" }
//   POST   /auth/register    -> { message, (optional) user/token }
//   GET    /auth/me          -> { user: {...} }
// If your backend uses different paths, change AUTH_API_* constants below.

import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_URL; // e.g. https://api.example.com
if (!BASE_URL) {
  // Provide a clear error at startup if env is missing
  // You can remove this throw and default to a localhost URL if desired
  // e.g., const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";
  throw new Error("REACT_APP_API_URL is not defined. Set it in your .env file.");
}
const AUTH_API_LOGIN = `${BASE_URL}/auth/login`;
const AUTH_API_REGISTER = `${BASE_URL}/auth/register`;
const AUTH_API_ME = `${BASE_URL}/auth/me`;

// Helpful in development to see where requests go
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.debug("[userService] API base:", BASE_URL);
}

// Helper to normalize a user object coming from various backends.
function normalizeUser(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const {
    id,
    _id,
    userId,
    username,
    email,
    role,
    createdAt,
    updatedAt,
    ...rest
  } = raw;
  return {
    id: id || _id || userId || rest?.id,
    username: username || rest?.username,
    email: email || rest?.email,
    role: role || rest?.role || "user",
    createdAt,
    updatedAt,
    ...rest,
  };
}

// Login user with username/password
export async function loginUser({ username, password }) {
  const res = await axios.post(
    AUTH_API_LOGIN,
    { username, password },
    { headers: { "Content-Type": "application/json" } }
  );

  // Expect res.data to contain { user, token }
  const token = res.data?.token;
  const user = normalizeUser(res.data?.user);
  if (!token || !user) {
    throw new Error("Malformed login response: expected token and user");
  }
  return { user, token };
}

// Register a new user. Backend may or may not auto-login.
export async function registerUser({ username, email, password }) {
  const res = await axios.post(
    AUTH_API_REGISTER,
    { username, email, password },
    { headers: { "Content-Type": "application/json" } }
  );
  // If backend returns user/token, surface them; otherwise just success message.
  const token = res.data?.token;
  const user = res.data?.user ? normalizeUser(res.data.user) : null;
  return { user, token, message: res.data?.message };
}

// Fetch the current authenticated user profile / role using stored token
export async function fetchCurrentUser(token) {
  if (!token) throw new Error("Missing auth token");
  const res = await axios.get(AUTH_API_ME, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const user = normalizeUser(res.data?.user || res.data);
  return user;
}

// Optionally: verify token still valid (simple HEAD or ping). Placeholder for extensibility.
export async function verifyToken(token) {
  if (!token) return false;
  try {
    await axios.get(AUTH_API_ME, { headers: { Authorization: `Bearer ${token}` } });
    return true;
  } catch {
    return false;
  }
}

// Utility to compute an expiry timestamp (1 hour by default) for auto-logout.
export function computeExpiry(ms = 60 * 60 * 1000) {
  return Date.now() + ms;
}

// Refresh role only (if backend has dedicated endpoint you can swap it here)
export async function fetchUserRole(token) {
  const user = await fetchCurrentUser(token);
  return user.role;
}

// NOTE: Purchase-related functions were moved to `purchaseService.js`.
// If you previously imported them from userService, update imports:
//   import { getPurchases, createPurchase, getTotalLast30Days } from "../services/purchaseService";