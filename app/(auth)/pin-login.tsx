// app/(auth)/pin-login.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Alert, Image, Pressable, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { getToken, saveToken, refreshAccessToken } from "../../lib/authService";
import { getCurrentUser } from "../../lib/auth";
import { useGlobalContext } from "../../context/GlobalProvider";
import { router } from "expo-router";
import PinKeypad from "../../components/PinKeypad";
import { images } from "../../constants";
import { checkBackendOrThrow } from "../../lib/network";

const PEPPER = "iskra.pin.v1"; // used for new/modern PIN hashes

const PinLogin = () => {
  const { setUser, setIsLoggedIn } = useGlobalContext();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  // Responsive sizing
  const { height } = useWindowDimensions();
  const logoH = Math.max(120, Math.min(240, Math.round(height * 0.18)));
  const titleSize = Math.max(18, Math.min(26, Math.round(height * 0.028)));
  const gapDots = Math.max(10, Math.min(20, Math.round(height * 0.02)));
  const gapKeypad = Math.max(20, Math.min(32, Math.round(height * 0.028)));

  useEffect(() => {
    (async () => {
      try {
        await checkBackendOrThrow();
      } catch {
        Alert.alert('Нет соединения', 'Сервер недоступен. Попробуйте позже.');
        router.replace('/(preload)'); // back to bootstrap
      }
    })();
  }, []);

  /**
   * Ensure we have a stored PIN:
   * - If SecureStore lost it (rare), try to restore from AsyncStorage backup.
   * - If neither exists, silently route to password login.
   */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let hash = await SecureStore.getItemAsync("pin_hash");
        if (!hash) {
          const backup = await AsyncStorage.getItem("pin_hash_backup");
          if (backup) {
            // restore into SecureStore with AFTER_FIRST_UNLOCK (iOS), harmless on Android
            const opts: any = {
              requireAuthentication: false,
              keychainAccessible: (SecureStore as any).AFTER_FIRST_UNLOCK || undefined,
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
  }, []);

  const handleDigit = (digit: string) => {
    if (loading) return;
    if (pin.length < 4) setPin((prev) => prev + digit);
  };

  const handleDelete = () => setPin((prev) => prev.slice(0, -1));

  /**
   * Backward-compatible PIN check:
   * - Accept both legacy hash (SHA256(pin)) and new hash (SHA256(pin+PEPPER)).
   * - If legacy matches, migrate to peppered hash + backup.
   */
  const checkPin = async () => {
    setLoading(true);
    try {
      const storedHash = await SecureStore.getItemAsync("pin_hash").catch(() => null);
      if (!storedHash) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const [hashPlain, hashPeppered] = await Promise.all([
        Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin),
        Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin + PEPPER),
      ]);

      const legacyMatch = storedHash === hashPlain;
      const modernMatch = storedHash === hashPeppered;

      if (!legacyMatch && !modernMatch) {
        Alert.alert("Неверный PIN-код");
        setPin("");
        return;
      }

      // If legacy matched, migrate to peppered + backup
      if (legacyMatch && !modernMatch) {
        try {
          const opts: any = {
            requireAuthentication: false,
            keychainAccessible: (SecureStore as any).AFTER_FIRST_UNLOCK || undefined,
          };
          await SecureStore.setItemAsync("pin_hash", hashPeppered, opts);
          await AsyncStorage.setItem("pin_hash_backup", hashPeppered);
        } catch {
          // non-fatal — user can still proceed
          console.warn("⚠️ Failed to migrate PIN hash to peppered version");
        }
      }

      // PIN OK → ensure we have a valid token; try refresh if missing
      let token = await getToken(false);
      if (!token) token = await refreshAccessToken();

      if (token) {
        await saveToken(token, false);
        const profile = await getCurrentUser();
        setUser(profile);
        setIsLoggedIn(true);
        router.replace("/home");
      } else {
        router.replace("/(auth)/sign-in"); // fallback to password if no usable token
      }
    } catch {
      router.replace("/(auth)/sign-in");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) {
      checkPin();
    }
  }, [pin]);

  return (
    <SafeAreaView className="bg-primary h-full">
      <View className="w-full justify-center px-4 flex-1">
        <Image source={images.iskra} style={{ width: "100%", height: logoH, marginBottom: 8 }} resizeMode="contain" />

        <View className="items-center">
          <Text style={{ fontSize: titleSize }} className="text-white text-center font-pregular mt-2">
            Введите PIN-код
          </Text>

          <View style={{ marginTop: gapDots, marginBottom: gapKeypad }} className="flex-row justify-center space-x-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <View
                key={idx}
                className={`w-6 h-6 rounded-full ${
                  pin.length > idx ? "bg-white" : "border-2 border-white"
                }`}
              />
            ))}
          </View>

          <PinKeypad onPress={handleDigit} onDelete={handleDelete} disabled={loading} />
        </View>

        <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
          <Text className="text-center text-base text-gray-300 mt-8 underline">Войти с паролем</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default PinLogin;
