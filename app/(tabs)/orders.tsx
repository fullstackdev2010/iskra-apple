// app/(tabs)/orders.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, SectionList, RefreshControl, Image, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../components/EmptyState';
import { router } from 'expo-router';
import { images, icons } from '../../constants';
import { listOrders, listOrdersPage } from '../../lib/orders';
import { useBottomLiftTabs } from '../../lib/useBottomLift';
import { useFocusEffect } from '@react-navigation/native';
import { useContentBottomPad } from '../../lib/responsive';
import CustomButton from '../../components/CustomButton';
import { useGlobalContext } from '../../context/GlobalProvider';

const SPECIAL_COLOR = '#D35400'; // match ItemCard special price color

function dateKeyOf(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatDateLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Без даты';
  try {
    return d.toLocaleDateString('ru-RRU', { day: 'numeric', month: 'long', year: 'numeric' } as any);
  } catch {
    return dateKeyOf(d);
  }
}

const PAGE_SIZE = 20;

export default function Orders() {
  const { isLoggedIn } = useGlobalContext();
  const [refreshing, setRefreshing] = useState(false);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // NEW: show spinner while the very first load is happening
  const [initialLoading, setInitialLoading] = useState(true);

  const listRef = useRef<SectionList>(null);

  // Base bottom padding from helper + stable pad
  const bottomPad = useBottomLiftTabs();
  const contentBottomPad = Math.max(bottomPad, useContentBottomPad());

  const sortOrders = (arr: any[]) => {
    const copy = [...(arr || [])];
    copy.sort((a: any, b: any) => {
      const da = new Date(a?.created_at ?? 0).getTime();
      const db = new Date(b?.created_at ?? 0).getTime();
      if (isNaN(da) || isNaN(db) || da === db) return (b?.id ?? 0) - (a?.id ?? 0);
      return db - da;
    });
    return copy;
  };

  const fetchInitial = useCallback(async () => {
    setInitialLoading(true); // <- start spinner
    try {
      const first = await listOrders(PAGE_SIZE);
      const sorted = sortOrders(first);
      setUserOrders(sorted);
      setOffset(sorted.length);                 // next page starts here
      setHasMore(sorted.length === PAGE_SIZE);  // if page full, there may be more
    } catch (e) {
      console.warn('Failed to load orders', e);
      setUserOrders([]);
      setOffset(0);
      setHasMore(false);
    } finally {
      setInitialLoading(false); // <- stop spinner
    }
  }, []);

  useEffect(() => { fetchInitial(); }, [fetchInitial]);

  // ❗ История заказов только для авторизованных пользователей
  useEffect(() => {
    if (!isLoggedIn) {
      router.replace('/sign-in');
    }
  }, [isLoggedIn]);

  useFocusEffect(
    useCallback(() => {
      fetchInitial();
      return () => {};
    }, [fetchInitial])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInitial();
    setRefreshing(false);
  };

  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const older = await listOrdersPage(offset, PAGE_SIZE);
      if (!older || older.length === 0) {
        setHasMore(false);
      } else {
        // de-duplicate by id, then sort again
        const map = new Map<number, any>();
        for (const o of userOrders) map.set(o.id, o);
        for (const o of older) map.set(o.id, o);
        const merged = sortOrders(Array.from(map.values()));
        setUserOrders(merged);
        setOffset(offset + older.length);
        setHasMore(older.length === PAGE_SIZE);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, offset, userOrders]);

  const sections = useMemo(() => {
    if (!userOrders?.length) return [];
    const map = new Map<string, { title: string; data: any[] }>();
    for (const o of userOrders) {
      const d = new Date(o?.created_at ?? 0);
      const key = isNaN(d.getTime()) ? 'nodate' : dateKeyOf(d);
      if (!map.has(key)) {
        map.set(key, {
          title: isNaN(d.getTime()) ? 'Без даты' : formatDateLabel(o.created_at),
          data: [],
        });
      }
      map.get(key)!.data.push(o);
    }
    return Array.from(map.values());
  }, [userOrders]);

  const Header = () => (
    <View className="bg-primary px-4 py-2">
      <View className="flex-row items-center justify-center">
        <Text className="text-xl text-white font-psemibold text-center" numberOfLines={1} ellipsizeMode="clip">
          Заказы Искра Юг
        </Text>
        <Image source={images.logoSmall} className="w-9 h-10 ml-3" resizeMode="contain" />
      </View>
    </View>
  );

  return (
    <SafeAreaView className="bg-primary flex-1">
      <Header />

      {/* NEW: initial loading spinner screen (prevents “empty with no progress”) */}
      {initialLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="text-white/80 mt-3">Загрузка заказов…</Text>
        </View>
      ) : sections.length > 0 ? (
        <SectionList
          ref={listRef}
          style={{ flex: 1 }}
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section: { title } }) => (
            <View className="bg-primary px-3 py-2 border-t border-b border-white/20">
              <Text className="text-lg font-psemibold text-white">{title}</Text>
            </View>
          )}
          renderItem={({ item, section }) => {
            const perSectionIndex = section.data.indexOf(item);
            const dt = new Date(item.created_at);
            const timeLabel = isNaN(dt.getTime()) ? '' : dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const isSpecial = Number(item?.order_type) === 2;
            const goToDetails = () =>
            router.push(`/store/details?orderId=${item.id}&orderNo=${perSectionIndex + 1}`);
            return (
              <Pressable
                onPress={goToDetails}
                accessibilityRole="button"
                hitSlop={6}
                android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                className="m-3"
                style={{ borderRadius: 12 }}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-md text-white mr-4 flex-1">
                    {perSectionIndex + 1}. {timeLabel ? `${timeLabel} – ` : ''}Сумма:{' '}
                    <Text style={{ color: isSpecial ? SPECIAL_COLOR : '#FFFFFF' }}>
                      {item.sum}₽
                    </Text>
                    {isSpecial ? <Text style={{ color: SPECIAL_COLOR }}>  (акция)</Text> : null}
                  </Text>
                  <Pressable onPress={goToDetails} hitSlop={8}>
                    <Image source={icons.eye} className="w-7 h-7" resizeMode="contain" style={{ tintColor: '#FFA001' }} />
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={() => <EmptyState title="Заказов не найдено" subtitle="" />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: contentBottomPad }}
          removeClippedSubviews={false}
          ListFooterComponent={() =>
            hasMore ? (
              <View className="px-4 py-3">
                <CustomButton
                  title={loadingMore ? 'Загрузка...' : 'Показать более старые заказы'}
                  handlePress={loadOlder}
                  containerStyles="w-full border-4 border-red-700"
                  textStyles="text-xl"
                />
              </View>
            ) : null
          }
        />
      ) : (
        // After first load completed: show real empty state
        <View className="flex-1">
          <EmptyState title="Заказов не найдено" subtitle="" />
        </View>
      )}
    </SafeAreaView>
  );
}
