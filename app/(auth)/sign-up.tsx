// app/(auth)/sign-up.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, Image, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { images } from '../../constants';
import FormField from '../../components/FormField';
import CustomButton from '../../components/CustomButton';
import { activate } from '../../lib/auth';
import { useGlobalContext } from '../../context/GlobalProvider';
import { stripHtmlTags, isValidEmail } from '../../lib/utils';

// kept for future auto-login if needed
const SignUp = () => {
  const { setUser, setIsLoggedIn } = useGlobalContext();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Responsive vertical spacing + logo sizing
  const { height } = useWindowDimensions();
  const topGap = Math.max(12, Math.min(24, Math.round(height * 0.02)));
  const logoH = Math.max(160, Math.min(240, Math.round(height * 0.2)));

  const submit = async () => {
    if (!form.email || !form.password) {
      Alert.alert('Ошибка ввода.', 'Пожалуйста заполните все поля.');
      return;
    }

    if (!isValidEmail(form.email)) {
      return Alert.alert('Неверный формат.', 'Проверьте эл. почту.');
    }

    if (form.password.length < 6) {
      return Alert.alert('Короткий пароль.', 'Пароль должен быть не менее 6 символов.');
    }

    setIsSubmitting(true);
    try {
      // ⚡ Моментальная активация корпоративной учётной записи
      await activate(stripHtmlTags(form.email), stripHtmlTags(form.password));
      Alert.alert(
        'Активация выполнена',
        'Ваш корпоративный доступ активирован. Теперь Вы можете выполнить вход.'
      );
      router.replace('/sign-in');
    } catch (error: any) {
      Alert.alert('Ошибка', 'Не удалось активировать корпоративный доступ.');
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
          <Text className="text-2xl text-white text-center font-pregular mt-2">
            Активация корпоративного доступа
          </Text>
          <FormField
            title="Эл. почта"
            value={form.email}
            handleChangeText={(e) => setForm({ ...form, email: e })}
            otherStyles="mt-5"
            placeholder="Введите эл. почту"
            keyboardType="email-address"
          />

          <FormField
            title="Пароль"
            value={form.password}
            handleChangeText={(e) => setForm({ ...form, password: e })}
            otherStyles="mt-5"
            placeholder="Введите пароль"
            keyboardType="default"
            isPassword
          />

          <CustomButton
            title="Активировать доступ"
            handlePress={submit}
            isLoading={isSubmitting}
            containerStyles="mt-7 border-4 border-red-700"
            textStyles="text-xl"
          />

          <View className="justify-center items-center pt-5 flex-row gap-2">
            <Text className="text-lg text-gray-100 font-pregular mt-3">
              Доступ уже активирован?
            </Text>
            <Text
              onPress={() => router.push('/sign-in')}
              className="text-lg font-psemibold text-secondary mt-3"
            >
              Вход
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignUp;
