// lib/authFlow.ts
import { useGlobalContext } from "../context/GlobalProvider";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

import {
  restoreBiometricSession,
  restoreSession,
} from "./authService";
import { handleError } from "./errorHandler";
import NetInfo from "@react-native-community/netinfo";

/**
 * Auth flow hook.
 *
 * Option A semantics:
 * - If guest_mode === "1" → HARD guest: no token/biometric/refresh restore, always "Новый Пользователь".
 * - If not guest → try to restore real user session from token/biometric/refresh.
 */
export const useAuthFlow = () => {
  const { setUser, setIsLoggedIn, setIsLoading } = useGlobalContext();

  const run = async () => {
    try {
      setIsLoading(true);

      const guest = await AsyncStorage.getItem("guest_mode");
      const tokenInStorage = await SecureStore.getItemAsync("access_token").catch(
        () => null
      );

      // ------------------------------------------------------
      // 🚫 RULE A: Guest Mode → HARD BLOCK ALL SESSION RESTORE
      // ------------------------------------------------------
      if (guest === "1") {
        console.log("🔹 AUTHFLOW: GUEST MODE → FORCE LOGGED OUT VIEW");

        // NEVER allow stored token to activate in this mode
        axios.defaults.headers.common["Authorization"] = undefined;

        setUser({
          username: "Новый Пользователь",
          email: "",
          usercode: "",
        } as any);
        setIsLoggedIn(false);

        router.replace("/(tabs)/home");
        return;
      }

      // ------------------------------------------------------
      // Real user flow — only if NOT guest
      // ------------------------------------------------------
      console.log("🔹 AUTHFLOW: REAL USER MODE");

      if (!tokenInStorage) {
        // no stored session → go to password login
        setUser(null as any);
        setIsLoggedIn(false);
        router.replace("/(auth)/sign-in");
        return;
      }

      // Network needed for biometrics/refresh
      const net = await NetInfo.fetch();
      const online = net.isConnected !== false;

      // Try biometric first
      if (online) {
        const bio = await restoreBiometricSession();
        if (bio) {
          setIsLoggedIn(true);
          router.replace("/home");
          return;
        }
      }

      // fallback → try refresh
      const ok = await restoreSession();
      if (ok) {
        setIsLoggedIn(true);
        router.replace("/home");
        return;
      }

      // token invalid → go to login
      setUser(null as any);
      setIsLoggedIn(false);
      router.replace("/(auth)/sign-in");
    } catch (err) {
      console.error("authFlow error:", err);
      handleError(err as any);
    } finally {
      setIsLoading(false);
    }
  };

  return { run };
};

export default useAuthFlow;
