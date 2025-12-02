// lib/authFlow.ts
import { useGlobalContext } from "../context/GlobalProvider";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { restoreBiometricSession, restoreSession } from "./authService";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";

export const useAuthFlow = () => {
  const { setIsLoggedIn, setUser, setIsLoading } = useGlobalContext();

  const run = async () => {
    try {
      setIsLoading(true);

      const guest = await AsyncStorage.getItem("guest_mode");
      const token = await SecureStore.getItemAsync("access_token").catch(() => null);

      // GUEST MODE — authFlow should do nothing
      if (guest === "1") {
        //console.log("AUTHFLOW: guest → don't restore real user.");
        setIsLoggedIn(false);
        setUser({
          username: "Новый Пользователь",
          email: "",
          usercode: "",
        } as any);
        return;
      }

      // NOT GUEST → restore previous real user
      //console.log("AUTHFLOW: restoring real user");

      if (!token) {
        setIsLoggedIn(false);
        setUser(null as any);
        router.replace("/(auth)/sign-in");
        return;
      }

      const net = await NetInfo.fetch();
      const online = net.isConnected !== false;

      if (online) {
        const bio = await restoreBiometricSession();
        if (bio) {
          setIsLoggedIn(true);
          router.replace("/home");
          return;
        }
      }

      const ok = await restoreSession();
      if (ok) {
        setIsLoggedIn(true);
        router.replace("/home");
        return;
      }

      setIsLoggedIn(false);
      setUser(null as any);
      router.replace("/(auth)/sign-in");
    } finally {
      setIsLoading(false);
    }
  };

  return { run };
};

export default useAuthFlow;
