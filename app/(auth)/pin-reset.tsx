// app/(auth)/pin-reset.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Alert, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import PinKeypad from '../../components/PinKeypad';
import { images } from '../../constants';
import { getToken, saveToken } from '../../lib/authService';
import { checkBackendOrThrow } from "../../lib/network";

const PEPPER = 'iskra.pin.v1';

const PinReset = () => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [phase, setPhase] = useState<'new' | 'confirm'>('new');
  const [loading, setLoading] = useState(false);
  const [secureStoreAvailable, setSecureStoreAvailable] = useState(true);

  // Responsive sizing like pin-login
  const { height } = useWindowDimensions();
  const logoH = Math.max(120, Math.min(240, Math.round(height * 0.18)));
  const titleSize = Math.max(18, Math.min(26, Math.round(height * 0.028)));
  const gapDots = Math.max(10, Math.min(20, Math.round(height * 0.02)));
  const gapKeypad = Math.max(20, Math.min(32, Math.round(height * 0.028)));

  useEffect(() => {
    const check = async () => {
      const available = await SecureStore.isAvailableAsync();
      setSecureStoreAvailable(available);

      if (!available) {
        // Silent fallback: skip PIN reset flow if secure storage is unsupported
        const token = await getToken(false);
        if (token) {
          await saveToken(token, false);
          try {
        await checkBackendOrThrow();
        router.replace('/home');
      } catch {
        Alert.alert("Нет соединения", "Сервер недоступен. Повторите позже.");
      }
        } else {
          router.replace('/(auth)/sign-in');
        }
      }
    };
    check();
  }, []);

  const handleDigit = (digit: string) => {
    if (loading) return;
    if (phase === 'new' && pin.length < 4) setPin(prev => prev + digit);
    if (phase === 'confirm' && confirmPin.length < 4) setConfirmPin(prev => prev + digit);
  };

  const handleDelete = () => {
    if (phase === 'new') setPin(prev => prev.slice(0, -1));
    if (phase === 'confirm') setConfirmPin(prev => prev.slice(0, -1));
  };

  const hashPin = (input: string) =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input + PEPPER);

  const saveNewPin = async () => {
    setLoading(true);
    try {
      // Guard again in case availability changed
      const available = await SecureStore.isAvailableAsync();
      if (!available) {
        const token = await getToken(false);
        if (token) {
          await saveToken(token, false);
          router.replace('/home');
        } else {
          router.replace('/(auth)/sign-in');
        }
        return;
      }

      const hashed = await hashPin(pin);

      // iOS Keychain: AFTER_FIRST_UNLOCK improves persistence; harmless on Android
      const opts: any = {
        requireAuthentication: false,
        keychainAccessible: (SecureStore as any).AFTER_FIRST_UNLOCK || undefined,
      };

      await SecureStore.setItemAsync('pin_hash', hashed, opts);
      // Backup so we can restore if SecureStore is wiped by OS/security reset
      await AsyncStorage.setItem('pin_hash_backup', hashed);

      router.replace('/home');
    } catch (err: any) {
      console.warn('PIN reset error:', err?.message ?? err);
      // Keep a minimal alert for unexpected failures (not for unsupported device)
      Alert.alert('Ошибка', 'Не удалось сохранить новый PIN-код.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (phase === 'new' && pin.length === 4) setPhase('confirm');
    if (phase === 'confirm' && confirmPin.length === 4) {
      if (pin === confirmPin) {
        saveNewPin();
      } else {
        Alert.alert('Ошибка', 'PIN-коды не совпадают.');
        setConfirmPin('');
      }
    }
  }, [pin, confirmPin, phase]);

  const activePin = phase === 'new' ? pin : confirmPin;

  return (
    <SafeAreaView className="bg-primary h-full">
      <View className="w-full justify-center px-4 flex-1">
        <Image
          source={images.iskra}
          style={{ width: '100%', height: logoH, marginBottom: 8 }}
          resizeMode="contain"
        />

        <View className="items-center">
          <Text style={{ fontSize: titleSize }} className="text-white text-center font-pregular mt-2">
            {phase === 'new' ? 'Введите новый PIN-код' : 'Подтвердите PIN-код'}
          </Text>

          {secureStoreAvailable ? (
            <>
              <View
                style={{ marginTop: gapDots, marginBottom: gapKeypad }}
                className="flex-row justify-center space-x-4"
              >
                {Array.from({ length: 4 }).map((_, idx) => (
                  <View
                    key={idx}
                    className={`w-6 h-6 rounded-full ${
                      activePin.length > idx ? 'bg-white' : 'border-2 border-white'
                    }`}
                  />
                ))}
              </View>

              <PinKeypad onPress={handleDigit} onDelete={handleDelete} />
            </>
          ) : (
            // On unsupported devices we redirect away, so this view will rarely show.
            <Text className="text-center text-red-400 mt-6">
              Ваше устройство не поддерживает безопасное хранение PIN-кода.
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default PinReset;
