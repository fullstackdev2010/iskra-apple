// app/(auth)/pin-setup.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Alert, Image, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PinKeypad from '../../components/PinKeypad';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { getToken, saveToken } from '../../lib/authService';
import { images } from '../../constants';
import { checkBackendOrThrow } from "../../lib/network";

const PEPPER = 'iskra.pin.v1';

const PinSetup = () => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [phase, setPhase] = useState<'set' | 'confirm'>('set');
  const [loading, setLoading] = useState(false);
  const [secureStoreAvailable, setSecureStoreAvailable] = useState(true);

  // Responsive sizing like pin-login
  const { height } = useWindowDimensions();
  const logoH = Math.max(120, Math.min(240, Math.round(height * 0.18)));
  const titleSize = Math.max(18, Math.min(26, Math.round(height * 0.028)));
  const gapDots = Math.max(10, Math.min(20, Math.round(height * 0.02)));
  const gapKeypad = Math.max(20, Math.min(32, Math.round(height * 0.028)));

  useEffect(() => {
    const checkAvailability = async () => {
      const available = await SecureStore.isAvailableAsync();
      setSecureStoreAvailable(available);

      if (!available) {
        const token = await getToken(false);
        if (token) {
          await saveToken(token, false);
          Alert.alert(
            'PIN не поддерживается.',
            'Устройство не поддерживает безопасное хранилище. Вход выполнен без PIN-кода.'
          );
          router.replace('/home');
        } else {
          Alert.alert('Ошибка', 'Токен не найден.');
          router.replace('/(auth)/sign-in');
        }
      }
    };
    checkAvailability();
  }, []);

  const handleDigit = (digit: string) => {
    if (loading) return;
    if (phase === 'set') {
      if (pin.length < 4) setPin(prev => prev + digit);
    } else {
      if (confirmPin.length < 4) setConfirmPin(prev => prev + digit);
    }
  };

  const handleDelete = () => {
    if (phase === 'set') setPin(prev => prev.slice(0, -1));
    else setConfirmPin(prev => prev.slice(0, -1));
  };

  const hashPin = (input: string) =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input + PEPPER);

  const trySave = async () => {
    setLoading(true);
    try {
      const hashed = await hashPin(pin);

      // iOS Keychain: AFTER_FIRST_UNLOCK improves persistence; harmless on Android
      const opts: any = {
        requireAuthentication: false,
        keychainAccessible: (SecureStore as any).AFTER_FIRST_UNLOCK || undefined,
      };

      await SecureStore.setItemAsync('pin_hash', hashed, opts);
      // Backup to AsyncStorage to recover if SecureStore gets wiped by OS/security reset
      await AsyncStorage.setItem('pin_hash_backup', hashed);

      const token = await getToken(false);
      if (token) {
        // Enable biometric preference here if you want PIN setup to also opt-in to biometrics
        await saveToken(token, true);
        Alert.alert('Готово', 'PIN-код и биометрический доступ сохранены.');
      } else {
        Alert.alert('Предупреждение', 'PIN сохранен, но токен не найден.');
      }
      // Strict sync B1: home requires server online
      try {
        await checkBackendOrThrow();
        router.replace('/home');
      } catch {
        Alert.alert("Нет соединения", "Сервер недоступен. Повторите позже.");
      }
    } catch (err: any) {
      console.warn('PIN save error:', err?.message ?? String(err));
      Alert.alert('Ошибка', 'Не удалось сохранить PIN. Возможно, устройство не поддерживает безопасное хранилище.');
    } finally {
      setLoading(false);
    }
  };

  const continueWithoutPin = async () => {
    const token = await getToken(false);
    if (token) {
      await saveToken(token, false);
      Alert.alert('Вход', 'Вы вошли без PIN-кода. Вы можете установить его позже.');
      try {
        await checkBackendOrThrow();
        router.replace('/home');
      } catch {
        Alert.alert("Нет соединения", "Сервер недоступен. Повторите позже.");
      }
    } else {
      Alert.alert('Ошибка', 'Токен не найден.');
    }
  };

  useEffect(() => {
    if (phase === 'confirm' && confirmPin.length === 4) {
      if (pin === confirmPin) {
        trySave();
      } else {
        Alert.alert('Ошибка', 'PIN-коды не совпадают.');
        setConfirmPin('');
      }
    }
    if (phase === 'set' && pin.length === 4) setPhase('confirm');
  }, [pin, confirmPin, phase]);

  const activePin = phase === 'set' ? pin : confirmPin;

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
            {phase === 'set' ? 'Придумайте PIN-код' : 'Повторите PIN-код'}
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
            <Text className="text-center text-red-400 mt-6">
              Ваше устройство не поддерживает безопасное хранение PIN-кода.
            </Text>
          )}
        </View>

        <Pressable onPress={continueWithoutPin}>
          <Text className="text-center text-base text-gray-300 mt-8 underline">
            Продолжить без PIN-кода
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default PinSetup;
