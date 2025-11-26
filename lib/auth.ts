// lib/auth.ts
import api from "../lib/api";
import { API_HOST } from "../lib/constants";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { removeToken, getToken, refreshAccessToken, disableBiometric } from "../lib/authService";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  // ⬇ added to support long-lived sessions
  refresh_token?: string;
}

export interface UserProfile {
  id: number;
  usercode: string;
  username: string;
  email: string;
  phone?: string;
  email2?: string;
  manager?: string;
  discount?: number;
  active?: boolean;
  action?: boolean;
  discount2?: number;
  action2?: boolean;
  created_at?: string;
}

/**
 * Utility: set Authorization header on the shared axios instance
 * using the currently stored (or refreshed) token.
 */
export async function setAuthHeaderFromToken(): Promise<void> {
  let token = await getToken();
  if (!token) {
    // Try to transparently refresh if access token is missing/expired
    token = await refreshAccessToken();
  }
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

/**
 * Sign in with email & password.
 * Returns the access token for secure storage.
 * Also persists refresh_token (if provided by backend) to SecureStore.
 */
export async function signIn(email: string, password: string): Promise<string> {
  const formBody = new URLSearchParams();
  formBody.append("username", email);
  formBody.append("password", password);

  const res = await fetch(`${API_HOST}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody.toString(),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`login failed: ${res.status} ${text}`);

  const data: LoginResponse = JSON.parse(text);
  if (!data.access_token) {
    throw new Error("Токен доступа не возвращен.");
  }

  // Persist refresh token (if the backend returned it)
  if (data.refresh_token) {
    try {
      await SecureStore.setItemAsync("refresh_token", data.refresh_token as string, {
        // no biometric requirement for background refresh
        requireAuthentication: false,
      } as any);
    } catch {
      // Non-fatal: app can still work for this session
      console.warn("⚠️ Failed to persist refresh_token");
    }
  }

  // Caller is responsible for storing the access token; we set axios header when needed
  return data.access_token;
}

/**
 * Activate a preloaded corporate account using email + contract password.
 * Backend responds with the same token shape as /auth/login.
 */
export async function activate(email: string, password: string): Promise<string> {
  const formBody = new URLSearchParams();
  formBody.append("email", email);
  formBody.append("password", password);

  const res = await fetch(`${API_HOST}/auth/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody.toString(),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`activate failed: ${res.status} ${text}`);

  const data: LoginResponse = JSON.parse(text);
  if (!data.access_token) {
    throw new Error("Токен доступа не возвращен.");
  }

  // Persist refresh token (если бэкенд вернёт)
  if (data.refresh_token) {
    try {
      await SecureStore.setItemAsync("refresh_token", data.refresh_token as string, {
        requireAuthentication: false,
      } as any);
    } catch {
      console.warn("⚠️ Failed to persist refresh_token (activate)");
    }
  }

  return data.access_token;
}

/**
 * Fetch the current user's profile from /auth/me.
 * Falls back to refresh if the access token is missing/expired.
 * By default it busts cache to avoid stale responses after profile changes.
 */
export async function getMe(opts?: { bustCache?: boolean }): Promise<UserProfile> {
  let token = await getToken();
  if (!token) {
    token = await refreshAccessToken();
  }
  if (!token) {
    throw new Error("Токен доступа не найден.");
  }

  const bustCache = opts?.bustCache ?? true;
  const url = new URL(`${API_HOST}/auth/me`);
  if (bustCache) url.searchParams.set("_", String(Date.now()));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      // Defensive cache controls in case a proxy misbehaves
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`me failed: ${res.status} ${text}`);

  const data: UserProfile = JSON.parse(text);

  // Keep axios instance in sync for any axios-based calls elsewhere
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  return data;
}

/**
 * Backwards-compat: get current user (no cache-bust by default).
 */
export async function getCurrentUser(): Promise<UserProfile> {
  return getMe({ bustCache: false });
}

/**
 * Sign out by removing stored tokens AND clearing PIN / biometric state,
 * so after account deletion the app starts clean (no PIN/biometric prompt).
 */

export async function signOut(): Promise<void> {
  // 1) Clear access/refresh token + logged_in flag inside authService
  await removeToken();

  // 2) Turn off biometric opt-in flag ("biometric_enabled")
  try {
    await disableBiometric();
  } catch (e) {
    console.warn("Failed to disable biometric flag:", e);
  }

  // 3) Clear PIN hash from SecureStore
  try {
    await SecureStore.deleteItemAsync("pin_hash");
  } catch (e) {
    console.warn("Failed to clear pin_hash from SecureStore:", e);
  }

  // 4) Clear PIN backup from AsyncStorage
  try {
    await AsyncStorage.removeItem("pin_hash_backup");
  } catch (e) {
    console.warn("Failed to clear pin_hash_backup from AsyncStorage:", e);
  }

  // 5) Drop Authorization header for axios client
  delete api.defaults.headers.common["Authorization"];
}
