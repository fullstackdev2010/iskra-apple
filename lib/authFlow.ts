// lib/authFlow.ts
import { router } from 'expo-router';
import { restoreBiometricSession, getToken } from './authService';
import { hydrateTokensOnce } from './authService';
import { getCurrentUser } from './auth';
import * as SecureStore from 'expo-secure-store';
import { useGlobalContext } from '../context/GlobalProvider';
import { checkInternetOrThrow, NetworkUnavailableError } from './network';
import { API_HOST } from './constants';
import { Platform, ToastAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

async function checkBackendOrThrow(timeoutMs = 4000) {
  await checkInternetOrThrow();

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
    try {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } catch {}
  } else {
    Alert.alert('Нет соединения', msg);
  }
}

export const useAuthFlow = () => {
  const { setUser, setIsLoggedIn } = useGlobalContext();

  const run = async () => {
    // ----------------------------------------------------
    // 🚫 GUEST MODE: Full logout BEFORE hydration happens
    // ----------------------------------------------------
    const guest = await AsyncStorage.getItem('guest_mode');
    if (guest === '1') {
      try { await SecureStore.deleteItemAsync("access_token"); } catch {}
      try { await SecureStore.deleteItemAsync("refresh_token"); } catch {}
      await AsyncStorage.removeItem("logged_in").catch(() => {});

      axios.defaults.headers.common["Authorization"] = undefined;

      setUser(null);
      setIsLoggedIn(false);

      router.replace('/(tabs)/home');
      return;
    }

    // ----------------------------------------------------
    // Normal authorization flow
    // ----------------------------------------------------

    await hydrateTokensOnce();

    try {
      await checkBackendOrThrow();
    } catch {
      notifyNoBackend();
      return;
    }

    // Biometric
    try {
      const bioToken = await restoreBiometricSession();
      if (bioToken) {
        try {
          await checkBackendOrThrow();
        } catch {
          notifyNoBackend();
          return;
        }

        const profile = await getCurrentUser();
        setUser(profile);
        setIsLoggedIn(true);
        router.replace('/home');
        return;
      }
    } catch (e) {
      console.warn('⚠️ Biometric auth failed:', e);
    }

    // PIN fallback
    try {
      const pinHash = await SecureStore.getItemAsync('pin_hash');
      const token = await getToken(false);
      if (token && pinHash) {
        try {
          await checkBackendOrThrow();
        } catch {
          notifyNoBackend();
          return;
        }
        router.replace('/(auth)/pin-login');
        return;
      }
    } catch (e) {
      console.warn('⚠️ PIN token check failed:', e);
    }

    // No session at all → guest browsing
    router.replace('/(tabs)/home');
  };

  return { run };
};
