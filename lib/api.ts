// lib/api.ts
import axios, { AxiosHeaders } from "axios";
import axiosRetry from "axios-retry";
import { API_HOST } from "./constants"; // ← fixed path
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToken, refreshAccessToken } from "./authService";
import NetInfo from "@react-native-community/netinfo";
import { Platform, ToastAndroid, Alert } from "react-native";

const api = axios.create({
  baseURL: API_HOST,
  headers: { "Content-Type": "application/json" },
  timeout: 15000, // 15s hard cap
});

// ---- Retry policy (idempotent only) ----
axiosRetry(api, {
  retries: 2,
  shouldResetTimeout: true,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) => {
    // Never retry if we intentionally canceled due to offline
    if (axios.isCancel(err) && String(err?.message) === "OFFLINE") return false;

    const cfg = (err?.config as any) || {};
    const method = String(cfg.method || "").toLowerCase();

    // Retry only safe/idempotent methods
    if (!["get", "head", "options"].includes(method)) return false;

    const status = err?.response?.status;

    // Retry on network errors (no status) or 5xx / 429
    return !status || status >= 500 || status === 429;
  },
});

// ---- Request: offline fast-fail, attach auth, add AbortController timeout ----
api.interceptors.request.use(async (config) => {
  // 0) Fast-fail if offline (treat only explicit false as offline)
  const net = await NetInfo.fetch();
  if (net.isConnected === false) {
    // If your Axios version <1.3, use: throw new (axios as any).Cancel("OFFLINE")
    throw new axios.CanceledError("OFFLINE");
  }

 // 1) 🚫 Guest mode → never attach Authorization header
  const guest = await AsyncStorage.getItem("guest_mode");
  if (guest === "1") {
    if (config.headers) {
      delete (config.headers as any).Authorization;
    }
    return config; // ← skip token completely
  }

  // 2) 🔐 Normal logged-in flow: attach access token
  const t = await getToken(false);
  if (t) {
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    } else if (!(config.headers instanceof AxiosHeaders)) {
      config.headers = new AxiosHeaders(config.headers as any);
    }
    (config.headers as AxiosHeaders).set("Authorization", `Bearer ${t}`);
  }

  // 2) Per-request AbortController as extra guard for RN socket hangs
  const ms = typeof config.timeout === "number" ? config.timeout : 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("TIMEOUT"), ms);
  (config as any).__abortTimer = timer;
  config.signal = controller.signal;

  return config;
});

// ---- Response: clear timer; normalize errors; refresh-once for 401 ----
api.interceptors.response.use(
  (response) => {
    const t = (response.config as any)?.__abortTimer;
    if (t) clearTimeout(t);
    return response;
  },
  async (error) => {
    const cfg = error?.config || {};
    const timer = (cfg as any).__abortTimer;
    if (timer) clearTimeout(timer);

    // Offline (canceled before request)
    if (axios.isCancel(error) && String(error?.message) === "OFFLINE") {
      return Promise.reject(new Error("Нет интернет-соединения"));
    }

    // Axios timeout
    if (error?.code === "ECONNABORTED") {
      return Promise.reject(
        new Error("Превышено время ожидания. Проверьте интернет-соединение.")
      );
    }

    // AbortController timeout
    if (error?.code === "ERR_CANCELED" && String(error?.message).includes("TIMEOUT")) {
      return Promise.reject(
        new Error("Превышено время ожидания. Проверьте интернет-соединение.")
      );
    }

    const { response, config } = error || {};

    // 401 → refresh once, then retry original request
    if (response?.status === 401 && config && !(config as any)._retry) {
      (config as any)._retry = true;
      const newTok = await refreshAccessToken();
      if (newTok) {
        api.defaults.headers.common.Authorization = `Bearer ${newTok}`;
        // Normalize and set on the retried request, too
        if (!config.headers) {
          config.headers = new AxiosHeaders();
        } else if (!(config.headers instanceof AxiosHeaders)) {
          config.headers = new AxiosHeaders(config.headers as any);
        }
        (config.headers as AxiosHeaders).set(
          "Authorization",
          `Bearer ${newTok}`
        );
        return api(config);
      }
    }

    return Promise.reject(error);
  }
);

// ---- Typed API helpers ----
type LineItem = {
  code: string;
  article: string;
  description: string;
  price: number;
  quantity: number;
};

export type OrderType = 1 | 2;

export async function createOrder(payload: {
  sum: number;
  items: LineItem[];
  order_type?: OrderType; // 1=regular, 2=special (defaults to 1 server-side if omitted)
}) {
  // NOTE: POST is not retried by axios-retry (by design above), preventing duplicate orders
  const response = await api.post("/orders/", payload);
  return response.data;
}

// ---- One-time toast on backend/network loss ----
let notifiedOnce = false;
function notifyBackendLostOnce() {
  if (notifiedOnce) return;
  notifiedOnce = true;
  const msg = "Нет связи с сервером.";
  if (Platform.OS === "android") {
    try { ToastAndroid.show(msg, ToastAndroid.SHORT); } catch {}
  } else {
    Alert.alert("Сеть", msg);
  }
  // reset after 20s so it can notify again later
  setTimeout(() => { notifiedOnce = false; }, 20000);
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const msg = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "").toLowerCase();
    const status = error?.response?.status ?? 0;
    // Network-ish failures: no response, timeouts, aborts
    const looksNetwork =
      !error?.response ||
      code === "err_network" ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("aborted");
    if (looksNetwork) {
      notifyBackendLostOnce();
    }
    return Promise.reject(error);
  }
);

export default api;
