// app/(auth)/sign-in.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, Image, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { images } from '../../constants';
import FormField from '../../components/FormField';
import CustomButton from '../../components/CustomButton';
import { signIn, getCurrentUser } from '../../lib/auth';
import { saveToken } from '../../lib/authService';
import { useGlobalContext } from '../../context/GlobalProvider';
import { stripHtmlTags, isValidEmail } from '../../lib/utils';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showFriendlyError } from '../../lib/errorHandler';

const SignIn = () => {
  const { setUser, setIsLoggedIn } = useGlobalContext();
  const [form, setForm] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Responsive vertical spacing + logo sizing
  const { height } = useWindowDimensions();
  const topGap = Math.max(12, Math.min(24, Math.round(height * 0.02)));
  const logoH = Math.max(180, Math.min(260, Math.round(height * 0.22)));

  const finalizeLogin = async () => {
    try {
      const profile = await getCurrentUser();
      setUser(profile);
      setIsLoggedIn(true);

      const pin = await SecureStore.getItemAsync('pin_hash');
      if (!pin) {
        router.replace('/(auth)/pin-setup');
      } else {
        await AsyncStorage.setItem('logged_in', '1');
        router.replace('/home');
      }
    } catch (err: any) {
      Alert.alert('Ошибка входа', 'Не удалось получить профиль пользователя.');
    }
  };

  const submit = async () => {
    if (!form.email || !form.password) {
      return Alert.alert('Ошибка ввода', 'Пожалуйста заполните все поля!');
    }

    if (!isValidEmail(form.email)) {
      return Alert.alert('Неверный формат.', 'Проверьте эл. почту.');
    }

    if (form.password.length < 6) {
      return Alert.alert('Короткий пароль.', 'Пароль должен быть не менее 6 символов.');
    }

    setIsSubmitting(true);
    try {
      const token = await signIn(stripHtmlTags(form.email), stripHtmlTags(form.password));
      await saveToken(token, false);
      finalizeLogin();
    } catch (err: any) {
      showFriendlyError(err, 'Ошибка входа');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="bg-primary h-full">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      >
        <View className="w-full justify-center px-4" style={{ marginTop: topGap }}>
          <Image
            source={images.iskra}
            style={{ width: '100%', height: logoH }}
            resizeMode="contain"
          />
          <Text className="text-2xl text-white text-center font-pregular mt-8">
            Вход в личный кабинет
          </Text>

          <FormField
            title=""
            value={form.email}
            placeholder="Введите эл. почту"
            handleChangeText={(e) => setForm({ ...form, email: e })}
            otherStyles="mt-9"
            keyboardType="email-address"
          />
          <FormField
            title=""
            value={form.password}
            placeholder="Введите пароль"
            handleChangeText={(e) => setForm({ ...form, password: e })}
            otherStyles="mt-5"
            keyboardType="default"
            isPassword
          />

          <CustomButton
            title="Вход"
            handlePress={submit}
            isLoading={isSubmitting}
            containerStyles="mt-12 border-4 border-red-700"
            textStyles="text-xl"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignIn;
