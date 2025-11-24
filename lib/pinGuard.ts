// lib/pinGuard.ts
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { router } from 'expo-router';

/**
 * Hook: if SecureStore is unavailable on this device, silently redirect
 * to the login/password page and skip the PIN flow entirely.
 */
export function useSecureStoreGuard() {
  useEffect(() => {
    (async () => {
      const supported = await SecureStore.isAvailableAsync();
      if (!supported) {
        // Silent fallback — no alerts
        router.replace('/(auth)/sign-in');
      }
    })();
  }, []);
}
