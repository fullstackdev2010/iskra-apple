// lib/network.ts
import * as Network from 'expo-network';
import { API_HOST } from './constants';

export class NetworkUnavailableError extends Error {
  code = 'NETWORK_UNAVAILABLE';
  constructor(message = 'Нет подключения к интернету') {
    super(message);
    this.name = 'NetworkUnavailableError';
  }
}

/**
 * Checks device connectivity and whether the internet is reachable.
 * Throws NetworkUnavailableError if offline or undeterminable.
 */
export async function checkInternetOrThrow() {
  try {
    const state = await Network.getNetworkStateAsync();
    if (!state.isConnected || state.isInternetReachable === false) {
      throw new NetworkUnavailableError();
    }
  } catch {
    throw new NetworkUnavailableError();
  }
}

/**
 * Quick backend health check with a short timeout.
 * HEAD /health is ideal (fallback to GET if your backend lacks HEAD).
 */
export async function checkBackendOrThrow(timeoutMs = 4000) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_HOST}/health`, {
      method: 'GET',     // ← GET instead of HEAD
      signal: ctl.signal,
    }).catch(() => null);
    if (!res || !('ok' in res) || !res.ok) {
      throw new NetworkUnavailableError('Нет соединения с сервером. Проверьте подключение.');
    }
  } finally {
    clearTimeout(id);
  }
}