// app/(tabs)/profile.tsx
import { View, Text, Image, Alert, ScrollView, RefreshControl, AppState, useWindowDimensions } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalContext } from '../../context/GlobalProvider';
import { images } from '../../constants';
import { router } from 'expo-router';
import ProfileCard from '../../components/ProfileCard';
import { getProfileUriByFileName } from '../../lib/pictures';
import { signOut, getMe } from '../../lib/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomLiftTabs } from '../../lib/useBottomLift';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import CustomButton from '../../components/CustomButton';

const Profile = () => {

  // ---- Feature flag: account deletion temporarily disabled ----
  const ACCOUNT_DELETE_ENABLED = false;

  const { user, setUser, setIsLoggedIn, isLoggedIn  } = useGlobalContext();
  const [pictureUri, setPictureUri] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  // --- bottom clipping protection (same pattern as other tabs) ---
  const bottomPad = useBottomLiftTabs();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const tabH = useBottomTabBarHeight?.() || 0;
  const bpTab = height < 680 ? 56 : height < 780 ? 60 : height < 900 ? 64 : 72;
  const effectiveTab = tabH > 0 ? tabH : bpTab;
  const contentBottomPad = Math.max(bottomPad, Math.round(effectiveTab * 0.9) + Math.max(6, insets.bottom));
  // --------------------------------------------------------------

  const logout = async () => {
    await signOut();
    setUser(null);
    setIsLoggedIn(false);
    router.push('/sign-in');
  };

  const confirmPinReset = () => {
    Alert.alert('Сброс PIN', 'Вы уверены, что хотите сбросить PIN-код?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Сбросить', onPress: () => router.push('/(auth)/pin-reset'), style: 'destructive' },
    ]);
  };

  const computeManagerPic = useCallback((manager?: string | null) => {
    const managerFile = manager ? `${manager}.jpg` : 'manager.jpg';
    const uri = getProfileUriByFileName(managerFile);
    return `${uri}${uri.includes('?') ? '&' : '?'}t=${Date.now()}`;
  }, []);

   const refreshUser = useCallback(async () => {
    // В гостевом режиме профиль не подгружаем и не трогаем токены
    if (!isLoggedIn) {
      setRefreshing(false);
      return;
    }

    try {
      setRefreshing(true);
      const fresh = await getMe();
      if (fresh) {
        setUser(fresh);
        setPictureUri(computeManagerPic(fresh.manager));
      }
    } catch (e: any) {
      console.warn('Failed to refresh user profile:', e);

      const msg = String(e?.message || '');
      // Если бэкенд говорит "Токен доступа не найден" — считаем, что сессия умерла
      if (msg.includes('Токен доступа не найден')) {
        try {
          await signOut();
        } catch (err) {
          console.warn('signOut error after token-missing:', err);
        }
        setUser(null);
        setIsLoggedIn(false);
        // Уводим на домашнюю вкладку в гостевой режим
        router.replace('/(tabs)/home');
        return;
      }

      // Для других ошибок просто откатываемся к имеющемуся менеджеру
      setPictureUri(computeManagerPic(user?.manager));
    } finally {
      setRefreshing(false);
    }
  }, [isLoggedIn, setUser, setIsLoggedIn, user?.manager, computeManagerPic]);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      return () => {};
    }, [refreshUser])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshUser();
    });
    return () => sub.remove();
  }, [refreshUser]);

  useEffect(() => {
    setPictureUri(computeManagerPic(user?.manager));
  }, [user?.manager, computeManagerPic]);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Удалить аккаунт',
      'Ваш доступ в приложении будет отключён. Для новой активации обратитесь к менеджеру.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              // вызов backend: DELETE /auth/me
              const api = (await import('../../lib/api')).default;
              await api.delete('/auth/me');

              await signOut();
              setUser(null);
              setIsLoggedIn(false);
              router.replace('/');   // 👈 go to index instead of login
            } catch (e) {
              Alert.alert('Ошибка', 'Не удалось удалить аккаунт. Попробуйте позже.');
            }
          },
        },
      ]
    );
  };

  // Гостевой режим: показываем экран "Нужно войти", а не падаем
  if (!isLoggedIn || !user) {
    return (
      <SafeAreaView className="bg-primary flex-1">
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-white text-center text-lg mb-4">
            Для доступа к профилю войдите в корпоративный аккаунт.
          </Text>
          <CustomButton
            title="Войти"
            handlePress={() => router.push('/sign-in')}
            containerStyles="border-4 border-red-700 p-4"
            textStyles="text-lg"
          />
        </View>
      </SafeAreaView>
    );
  }

  const Header = () => (
    <View className="bg-primary px-4 pt-2 pb-3">
      <View className="flex-row items-end justify-between">
        <View className="flex-shrink">
          <Text className="font-pmedium text-md text-gray-100" numberOfLines={1}>
            Добро пожаловать,
          </Text>
          <Text className="text-xl font-psemibold text-white" numberOfLines={1} ellipsizeMode="tail">
            {user?.username}
          </Text>
        </View>
        <Image source={images.logoSmall} className="w-9 h-10 ml-3" resizeMode="contain" />
      </View>
    </View>
  );

  return (
    <SafeAreaView className="bg-primary flex-1">
      <Header />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: contentBottomPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshUser} tintColor="#ffffff" />}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-4 space-y-6">
          <Text className="mt-2 text-xl font-psemibold text-white text-center">Ваш менеджер</Text>

          <ProfileCard
            manager={user.manager ?? ''}
            email2={user.email2}
            phone={user.phone}
            picture={pictureUri}
            handlePress={logout}
            onResetPin={confirmPinReset}
            onDeleteAccount={ACCOUNT_DELETE_ENABLED ? handleDeleteAccount : undefined}
          />

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
