// lib/authFlow.ts
import { router } from 'expo-router';
import { restoreBiometricSession, getToken, setGlobalToken } from './authService';
import { getCurrentUser } from './auth';
import * as SecureStore from 'expo-secure-store';
import { useGlobalContext } from '../context/GlobalProvider';
import { checkInternetOrThrow, NetworkUnavailableError } from './network';
import { API_HOST } from './constants';
import { Platform, ToastAndroid, Alert } from 'react-native';

async function checkBackendOrThrow(timeoutMs = 4000) {
  // First, confirm device has internet
  await checkInternetOrThrow();

  // Then, confirm backend is reachable (expects GET /health on the server)
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_HOST}/health`, { method: 'GET', signal: ctl.signal });
    if (!res || !res.ok) {
      throw new NetworkUnavailableError('Сервер недоступен');
    }
  } catch {
    throw new NetworkUnavailableError('Сервер недоступен');
  } finally {
    clearTimeout(t);
  }
}

function notifyNoBackend() {
  const msg = 'Нет соединения с сервером. Попробуйте позже.';
  if (Platform.OS === 'android') {
    try { ToastAndroid.show(msg, ToastAndroid.SHORT); } catch {}
  } else {
    Alert.alert('Нет соединения', msg);
  }
}

export const useAuthFlow = () => {
  const { setUser, setIsLoggedIn } = useGlobalContext();

  const run = async () => {
    // Hard gate at startup: if no internet OR no backend, show toast and STOP.
    try {
      await checkBackendOrThrow();
    } catch {
      notifyNoBackend();
      return; // ← do not proceed to biometric or PIN
    }

    // Biometric fast path
    try {
      const bioToken = await restoreBiometricSession();
      if (bioToken) {
        try {
          // Double-check backend before touching it (in case state changed)
          await checkBackendOrThrow();
        } catch {
          notifyNoBackend();
          return; // ← do not proceed
        }

        const profile = await getCurrentUser();
        setUser(profile);
        setIsLoggedIn(true);
        // setGlobalToken(bioToken); // uncomment if you rely on a global header
        router.replace('/home'); // keep your route as provided
        return;
      }
    } catch (e) {
      console.warn('⚠️ Biometric auth failed:', e);
    }

    // PIN fallback path — only if backend is reachable right now
    try {
      const pinHash = await SecureStore.getItemAsync('pin_hash');
      const token = await getToken(false);
      if (token && pinHash) {
        try {
          await checkBackendOrThrow();
        } catch {
          notifyNoBackend();
          return; // ← do not show PIN when backend is down
        }
        router.replace('/(auth)/pin-login');
        return;
      }
    } catch (e) {
      console.warn('⚠️ PIN token check failed:', e);
    }

    router.replace('/(auth)/sign-in');
  };

  return { run };
};
