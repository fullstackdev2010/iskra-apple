// lib/authService.ts
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import axios from "axios";
import { API_HOST } from "./constants";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const BIOMETRIC_FLAG = "biometric_enabled";
const LOGGED_IN_FLAG = "logged_in";
const PROBE_KEY = "__securestore_probe__";

let cachedToken: string | null = null;
let hydrated = false;

export async function hydrateTokensOnce() {
  if (hydrated) return;
  hydrated = true;
  const usable = await secureStoreUsable();
  if (!usable) return;

  try {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY, { requireAuthentication: false } as any);
    if (token) setGlobalToken(token);
  } catch {}
}

let usableCache: boolean | null = null;

export function setGlobalToken(token: string | null) {
  cachedToken = token;
  if (token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common["Authorization"];
  }
}

/** Robust capability probe (don’t trust isAvailableAsync alone) */
async function secureStoreUsable(): Promise<boolean> {
  if (usableCache !== null) return usableCache;
  try {
    const avail = await SecureStore.isAvailableAsync().catch(() => false);
    // Probe actual R/W — some devices work even if avail=false
    await SecureStore.setItemAsync(PROBE_KEY, "1", { requireAuthentication: false } as any);
    const v = await SecureStore.getItemAsync(PROBE_KEY, { requireAuthentication: false } as any);
    await SecureStore.deleteItemAsync(PROBE_KEY).catch(() => {});
    usableCache = !!v || !!avail;
    return usableCache;
  } catch {
    usableCache = false;
    return false;
  }
}

/** Optional helper for UI */
export async function isSecureStoreSupported(): Promise<boolean> {
  return secureStoreUsable();
}

/**
 * Save access (and optional refresh) tokens.
 * IMPORTANT: persist with requireAuthentication:false — we gate via PIN/biometric in app flow.
 * iOS: use AFTER_FIRST_UNLOCK to better survive reboots.
 */
export async function saveTokens(
  accessToken: string,
  refreshToken?: string,
  biometricEnabled = false
) {
  setGlobalToken(accessToken);

  const usable = await secureStoreUsable();
  if (usable) {
    try {
      const opts: any = {
        requireAuthentication: false,
        keychainAccessible: (SecureStore as any).AFTER_FIRST_UNLOCK || undefined,
      };
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, opts);
      if (refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, opts);
      }
    } catch {
      console.warn("🔕 SecureStore write failed — using in-memory token only");
    }
  } else {
    console.warn("🔕 SecureStore unavailable — skipping token persistence");
  }

  // Preserve existing biometric preference unless explicitly enabled here
  const prev = (await AsyncStorage.getItem(BIOMETRIC_FLAG)) ?? "0";
  await AsyncStorage.setItem(BIOMETRIC_FLAG, biometricEnabled ? "1" : prev);
  await AsyncStorage.setItem(LOGGED_IN_FLAG, "1");
}

/** Back-compat */
export async function saveToken(token: string, biometricEnabled = false) {
  return saveTokens(token, undefined, biometricEnabled);
}

export async function getToken(_requireAuth = true): Promise<string | null> { 
  // ✔ Guest mode does NOT block token restore.
  // Guest mode only affects routing, not token logic.
  if (cachedToken) return cachedToken;
  const usable = await secureStoreUsable();
  if (!usable) return null;

  try {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY, { requireAuthentication: false } as any);
    if (token) setGlobalToken(token);
    return token ?? null;
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  const usable = await secureStoreUsable();
  if (!usable) return null;
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, { requireAuthentication: false } as any);
  } catch {
    return null;
  }
}

/** Remove tokens only — keep PIN & biometric preference intact */
export async function removeToken() {
  setGlobalToken(null);
  const usable = await secureStoreUsable();
  if (usable) {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    } catch {}
    try {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch {}
  }
  await AsyncStorage.removeItem(LOGGED_IN_FLAG);
}

/** Explicitly turn off biometric (does NOT touch tokens) */
export async function disableBiometric() {
  await AsyncStorage.removeItem(BIOMETRIC_FLAG);
}

/**
 * Biometric restore:
 * - only if user opted-in (BIOMETRIC_FLAG='1'),
 * - only if hardware & enrollment are present,
 * - explicitly prompt with LocalAuthentication,
 * - then load/refresh tokens without gating in SecureStore.
 */
export async function restoreBiometricSession(): Promise<string | null> {

  await hydrateTokensOnce();  // ensure token is loaded before biometric flow

  // tiny delay ensures SecureStore is ready after fast reopen
  await new Promise(r => setTimeout(r, 100));

  const optIn = await AsyncStorage.getItem(BIOMETRIC_FLAG);
  if (optIn !== "1") return null;

  const usable = await secureStoreUsable();
  if (!usable) return null;

  const hasHw = await LocalAuthentication.hasHardwareAsync().catch(() => false);
  const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
  if (!hasHw || !enrolled) return null;

  // 🔐 Explicit biometric prompt
  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: "Вход по биометрии",
    cancelLabel: "Отмена",
    disableDeviceFallback: false,
  });
  if (!auth.success) return null;

  await new Promise(r => setTimeout(r, 80)); // extra stability

  // Strict sync mode B1:
  // PIN flow handles refresh explicitly.
  // Biometric must NOT auto-refresh. If token is missing → return null.
  let token = await getToken(false);
  if (!token) {
    return null;
  }

  if (token) {
    setGlobalToken(token);
    return token;
  }
  return null; // biometric ok but no valid token → go to PIN
}

/** Try restore; if no token, try refresh */
export const restoreSession = async (): Promise<boolean> => {
  const token = await getToken(false);
  if (token) return true;
  const refreshed = await refreshAccessToken();
  return !!refreshed;
};

/** Refresh access token via backend (if available) with rotation support */
let _refreshing = false;
let _waiters: Array<() => void> = [];

export async function refreshAccessToken(): Promise<string | null> {
  if (_refreshing) {
    await new Promise<void>((res) => _waiters.push(res));
    return getToken(false);
  }
  _refreshing = true;
  try {
    const rt = await getRefreshToken();
    if (!rt) return null;

    const res = await fetch(`${API_HOST}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // ✅ server expects { "refresh_token": "<token>" }
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    const access = (data?.access_token as string | undefined) ?? null;
    const rotated = (data?.refresh_token as string | undefined) ?? rt; // keep old if server didn’t rotate
    if (!access) return null;

    await saveTokens(access, rotated, false);
    return access;
  } catch {
    return null;
  } finally {
    _refreshing = false;
    _waiters.forEach((fn) => fn());
    _waiters = [];
  }
}
