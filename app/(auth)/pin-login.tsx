// app/(auth)/pin-login.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Alert, Image, Pressable, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { getToken, saveToken, refreshAccessToken } from "../../lib/authService";
import { getCurrentUser } from "../../lib/auth";
import { useGlobalContext, setGuestSession } from "../../context/GlobalProvider";
import { router } from "expo-router";
import PinKeypad from "../../components/PinKeypad";
import { images } from "../../constants";
import { checkBackendOrThrow } from "../../lib/network";

const PEPPER = "iskra.pin.v1";

const PinLogin = () => {
  const { setUser, setIsLoggedIn } = useGlobalContext();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const { height } = useWindowDimensions();
  const logoH = Math.max(120, Math.min(240, Math.round(height * 0.18)));
  const titleSize = Math.max(18, Math.min(26, Math.round(height * 0.028)));
  const gapDots = Math.max(10, Math.min(20, Math.round(height * 0.02)));
  const gapKeypad = Math.max(20, Math.min(32, Math.round(height * 0.028)));

  // -------------------------------------------------------------
  // 1) Hydration: DO NOT redirect if backend offline.
  // Show alert once and allow user to retry PIN later.
  // -------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        await checkBackendOrThrow();
      } catch {
        Alert.alert("Нет соединения", "Сервер недоступен. Повторите попытку позже.");
        // Stay on PIN screen — NO redirect.
      }
      // Small pause allows SecureStore to be ready
      await new Promise((r) => setTimeout(r, 120));
      setHydrated(true);
    })();
  }, []);

  // -------------------------------------------------------------
  // 2) Ensure PIN exists (local-only check)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!hydrated) return;

    let active = true;
    (async () => {
      try {
        let hash = await SecureStore.getItemAsync("pin_hash");

        if (!hash) {
          const backup = await AsyncStorage.getItem("pin_hash_backup");
          if (backup) {
            const opts: any = {
              requireAuthentication: false,
              keychainAccessible:
                (SecureStore as any).AFTER_FIRST_UNLOCK || undefined,
            };
            await SecureStore.setItemAsync("pin_hash", backup, opts);
            hash = backup;
          }
        }

        if (!hash && active) {
          router.replace("/(auth)/sign-in");
        }
      } catch {
        if (active) router.replace("/(auth)/sign-in");
      }
    })();

    return () => {
      active = false;
    };
  }, [hydrated]);

  const handleDigit = (d: string) => {
    if (loading) return;
    if (pin.length < 4) setPin((p) => p + d);
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  // -------------------------------------------------------------
  // 3) Main PIN check — STRICT SYNC MODE (B1)
  // -------------------------------------------------------------
  const checkPin = async () => {
    setLoading(true);
    try {
      const storedHash = await SecureStore.getItemAsync("pin_hash").catch(() => null);
      if (!storedHash) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const [legacy, modern] = await Promise.all([
        Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin),
        Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin + PEPPER),
      ]);

      const legacyMatch = storedHash === legacy;
      const modernMatch = storedHash === modern;

      if (!legacyMatch && !modernMatch) {
        Alert.alert("Неверный PIN-код");
        setPin("");
        return;
      }

      // Migrate legacy hash → modern hash
      if (legacyMatch && !modernMatch) {
        try {
          const newHash = modern;
          const opts: any = {
            requireAuthentication: false,
            keychainAccessible: (SecureStore as any).AFTER_FIRST_UNLOCK || undefined,
          };
          await SecureStore.setItemAsync("pin_hash", newHash, opts);
          await AsyncStorage.setItem("pin_hash_backup", newHash);
        } catch {}
      }

      // -------------------------------------------------------------
      // STRICT OPTION B1: backend *must* be online to continue.
      // -------------------------------------------------------------
      try {
        await checkBackendOrThrow(3000);
      } catch {
        Alert.alert("Нет соединения", "Сервер недоступен. Попробуйте позже.");
        return; // Stay on PIN screen
      }

      // -------------------------------------------------------------
      // Token handling — MINIMAL CHANGES
      // -------------------------------------------------------------
      let token: string | null = await getToken(false);

      // If token missing, only then try refresh
      if (!token) {
        token = await refreshAccessToken();

        if (!token) {
          // Backend is online but refresh failed → user must reauthenticate
          router.replace("/(auth)/sign-in");
          return;
        }
      }

      await saveToken(token, false);

      // Guest cleanup
      await AsyncStorage.removeItem("guest_mode");
      await AsyncStorage.removeItem("guest_ignore_token");
      setGuestSession(false);

      // Load profile (backend guaranteed online at this point)
      const profile = await getCurrentUser();
      setUser(profile);
      setIsLoggedIn(true);

      await AsyncStorage.setItem("logged_in", "1");

      router.replace("/home");
    } catch (err) {
      // No redirect unless token truly invalid.
      Alert.alert("Ошибка", "Не удалось выполнить вход. Повторите попытку.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    if (pin.length === 4) checkPin();
  }, [pin, hydrated]);

  return (
    <SafeAreaView className="bg-primary h-full">
      <View className="w-full justify-center px-4 flex-1">
        <Image
          source={images.iskra}
          style={{ width: "100%", height: logoH, marginBottom: 8 }}
          resizeMode="contain"
        />

        <View className="items-center">
          <Text
            style={{ fontSize: titleSize }}
            className="text-white text-center font-pregular mt-2"
          >
            Введите PIN-код
          </Text>

          <View
            style={{ marginTop: gapDots, marginBottom: gapKeypad }}
            className="flex-row justify-center space-x-4"
          >
            {Array.from({ length: 4 }).map((_, idx) => (
              <View
                key={idx}
                className={`w-6 h-6 rounded-full ${
                  pin.length > idx ? "bg-white" : "border-2 border-white"
                }`}
              />
            ))}
          </View>

          <PinKeypad
            onPress={handleDigit}
            onDelete={handleDelete}
            disabled={loading}
          />
        </View>

        <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
          <Text className="text-center text-base text-gray-300 mt-8 underline">
            Войти с паролем
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default PinLogin;
