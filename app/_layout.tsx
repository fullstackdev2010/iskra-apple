// app/_layout.tsx
import "../global.css";
import { SplashScreen, Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GlobalProvider from '../context/GlobalProvider';
import { hydrateTokensOnce } from '../lib/authService';
import 'regenerator-runtime/runtime';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorFallback from '../components/ErrorFallback';
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

SplashScreen.preventAutoHideAsync();

const toastBaseStyle = {
  // Remove default tall height and allow content to define it
  minHeight: 0 as number | undefined,
  height: undefined as number | undefined,
  // Make it narrower so text wraps naturally
  marginHorizontal: 16,
  // Tighter vertical padding for a shorter toast
  paddingVertical: 8,
  borderRadius: 12, // ~ rounded-xl
  // You already use a 4px border; we keep that and set color per-variant below
  borderWidth: 4,
};

const toastContentStyle = {
  paddingHorizontal: 12,
  paddingVertical: 0,
  alignItems: 'center' as const,   // center the text block
  justifyContent: 'center' as const,
};

const text1Style = {
  fontSize: 16,
  fontFamily: 'Poppins-SemiBold',
  flexShrink: 1 as const,
  textAlign: 'center' as const,    // center text
  width: '100%' as const,          // ensure full width so centering works
};
const text2Style = {
  fontSize: 14,
  fontFamily: 'Poppins-Regular',
  flexShrink: 1 as const,
  textAlign: 'center' as const,
  width: '100%' as const,
};

const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ 
        ...toastBaseStyle, 
        borderColor: '#FF9D06',
        borderLeftColor: '#FF9D06',   // <-- FIX FOR iOS WHITE BORDER
      }}
      contentContainerStyle={toastContentStyle}
      text1Style={text1Style}
      text2Style={text2Style}
      text1NumberOfLines={6}
      text2NumberOfLines={6}
      text1Props={{ ellipsizeMode: 'tail' }}
      text2Props={{ ellipsizeMode: 'tail' }}
    />
  ),

  error: (props) => (
    <ErrorToast
      {...props}
      style={{ 
        ...toastBaseStyle, 
        borderColor: '#FC0000',
        borderLeftColor: '#FC0000',   // <-- FIX FOR iOS WHITE BORDER
      }}
      contentContainerStyle={toastContentStyle}
      text1Style={text1Style}
      text2Style={text2Style}
      text1NumberOfLines={6}
      text2NumberOfLines={6}
      text1Props={{ ellipsizeMode: 'tail' }}
      text2Props={{ ellipsizeMode: 'tail' }}
    />
  ),

  info: (props) => (
    <BaseToast
      {...props}
      style={{ 
        ...toastBaseStyle, 
        borderColor: '#2563eb',
        borderLeftColor: '#2563eb',   // <-- FIX FOR iOS WHITE BORDER
      }}
      contentContainerStyle={toastContentStyle}
      text1Style={text1Style}
      text2Style={text2Style}
      text1NumberOfLines={6}
      text2NumberOfLines={6}
      text1Props={{ ellipsizeMode: 'tail' }}
      text2Props={{ ellipsizeMode: 'tail' }}
    />
  ),
};

const RootLayout = () => {
  const [fontsLoaded, error] = useFonts({
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
    if (fontsLoaded) SplashScreen.hideAsync();
    // Force-securestore hydration early
    hydrateTokensOnce();
  }, [fontsLoaded, error]);

  if (!fontsLoaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <GlobalProvider>
          <Stack
            screenOptions={{
              animation: "fade",
              contentStyle: { backgroundColor: "#161622" },
            }}
          >
            <Stack.Screen name='index' options={{ headerShown: false }} />
            <Stack.Screen name='(preload)/index' options={{ headerShown: false }} />
            <Stack.Screen name='(auth)' options={{ headerShown: false }} />
            <Stack.Screen name='(tabs)' options={{ headerShown: false }} />
            <Stack.Screen name='search/[query]' options={{ headerShown: false }} />
          </Stack>

          {/* Global Toast with unified style & position */}
          <Toast position="top" topOffset={80} visibilityTime={2500} config={toastConfig} />
        </GlobalProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
