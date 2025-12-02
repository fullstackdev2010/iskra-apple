// app/index.tsx
import {
  Image,
  Text,
  View,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
} from "react-native";
import { Redirect, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { images } from "../constants";
import CustomButton from "../components/CustomButton";
import { useGlobalContext, setGuestSession } from "../context/GlobalProvider";
import { useBreakpoint, useResponsiveValue } from "../lib/useBreakpoint";
import { useBottomLiftStandalone } from "../lib/useBottomLift";

import { checkInternetOrThrow, NetworkUnavailableError } from "@/lib/network";
import { handleError } from "@/lib/errorHandler";

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import React from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function App() {
  const { setUser, setIsLoggedIn, isLoading, isLoggedIn } = useGlobalContext();
  const bp = useBreakpoint();
  const { width: winW, height: winH } = useWindowDimensions();
  const shortSide = Math.min(winW, winH);

  const bottomPad = useBottomLiftStandalone();

  const containerMaxW = useResponsiveValue<number>(
    { compact: 360, regular: 420, large: 480, xlarge: 640 },
    420
  );

  const titleSize = useResponsiveValue<number>(
    { compact: 22, regular: 26, large: 30, xlarge: 34 },
    26
  );
  const titleLH = Math.round(titleSize * 1.28);

  const subtitleSize = useResponsiveValue<number>(
    { compact: 16, regular: 18, large: 20, xlarge: 22 },
    18
  );
  const subtitleLH = Math.round(subtitleSize * 1.35);

  const topPadding = useResponsiveValue<number>(
    { compact: 16, regular: 24, large: 32, xlarge: 40 },
    24
  );

  const ctaTop = useResponsiveValue<number>(
    { compact: 24, regular: 32, large: 40, xlarge: 48 },
    32
  );

  const heroFrac = useResponsiveValue<number>(
    { compact: 0.3, regular: 0.28, large: 0.25, xlarge: 0.22 },
    0.28
  );
  const heroMin = 140;
  const heroMax = 260;

  const heroHeight = clamp(Math.round(shortSide * heroFrac), heroMin, heroMax);
  const isCompact = bp === "compact";

  const [ctaLoading, setCtaLoading] = React.useState(false);

  // --------------------------------------------------------
  // ✔ Continue as Guest — HARD guest mode
  // --------------------------------------------------------
  const handleContinue = async () => {
    if (ctaLoading) return;
    setCtaLoading(true);

    try {
      // Mark guest in storage AND in in-memory global flag
      await AsyncStorage.setItem("guest_mode", "1");
      await AsyncStorage.setItem("guest_ignore_token", "1");
      setGuestSession(true);

      // Prevent using token for this session
      delete axios.defaults.headers.common["Authorization"];

      // Force guest user in context
      setUser({
        username: "Новый Пользователь",
        email: "",
        usercode: "",
      });
      setIsLoggedIn(false);

      await checkInternetOrThrow();

      // Use navigate so back button returns to landing page
      router.navigate("/(tabs)/home");
    } catch (err: any) {
      if (err instanceof NetworkUnavailableError) {
        handleError(err, {
          userMessage:
            "Нет подключения к интернету. Проверьте сеть и попробуйте ещё раз.",
        });
      } else {
        handleError(err);
      }
    } finally {
      setCtaLoading(false);
    }
  };

  // --------------------------------------------------------
  // ✔ Authorization link — disables guest mode and re-runs authFlow
  // --------------------------------------------------------
  const handleAuthLink = async () => {
    try {
      // 🔹 Leave guest world both in storage and in memory
      await AsyncStorage.removeItem("guest_mode");
      await AsyncStorage.removeItem("guest_ignore_token");
      setGuestSession(false);

      await checkInternetOrThrow();

      // go through preload/authFlow so stored token / biometric / PIN can restore
      router.replace("/(preload)");
    } catch (err: any) {
      if (err instanceof NetworkUnavailableError) {
        handleError(err, { userMessage: "Нет подключения к интернету." });
      } else {
        handleError(err);
      }
    }
  };

  if (!isLoading && isLoggedIn) return <Redirect href="/home" />;

  return (
    <SafeAreaView className="bg-primary h-full">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomPad }}
      >
        <View
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: containerMaxW,
            paddingHorizontal: 16,
            paddingTop: topPadding,
          }}
        >
          <Image
            source={images.iskra}
            style={{
              width: "100%",
              maxWidth: 380,
              height: heroHeight,
              alignSelf: "center",
              marginTop: 25,
            }}
            resizeMode="contain"
            accessible
            accessibilityLabel="Искра Юг — логотип"
          />

          <View style={{ alignItems: "center", marginTop: 25 }}>
            <Text
              style={{
                fontSize: titleSize,
                lineHeight: titleLH,
                color: "white",
                textAlign: "center",
              }}
            >
              Универсальная платформа для заказа электроинструмента ТМ Электроприбор, ЭЛТИ,
              Приоритет, Усадьба. г. Ростов-на-Дону.
            </Text>
          </View>

          <Text
            style={{
              fontSize: subtitleSize,
              lineHeight: subtitleLH,
              color: "#e5e7eb",
              textAlign: "center",
              marginTop: 20,
              marginBottom: 20,
            }}
          >
            Для получения доступа обратитесь в офис компании Искра Юг - iskra-ug.ru.
          </Text>

          <View style={{ marginTop: ctaTop }}>
            <CustomButton
              title="Продолжить для просмотра"
              handlePress={handleContinue}
              containerStyles="w-full border-4 border-red-700"
              textStyles={isCompact ? "text-lg" : "text-xl"}
              isLoading={ctaLoading}
            />
          </View>

          <View style={{ marginTop: 20, alignItems: "center" }}>
            <TouchableOpacity onPress={handleAuthLink} activeOpacity={0.7}>
              <Text
                style={{
                  color: "#93c5fd",
                  fontSize: 18,
                  textDecorationLine: "underline",
                }}
              >
                Авторизация
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}
