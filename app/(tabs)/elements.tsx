// app/(tabs)/elements.tsx
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  useWindowDimensions,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '../../components/EmptyState';
import PictureUri from '../../components/PictureUri';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import Toast from 'react-native-toast-message';
import SearchInput from '../../components/SearchInput';
import { fetchItemsByCode, fetchToolsByCode, fetchPartsByCode } from '../../lib/trade';
import { useBottomLiftTabs } from '../../lib/useBottomLift';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

const Elements = () => {
  const navigation = useNavigation();
  const [tradeItems, setTradeItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { code, catalog, hierarchy } = useLocalSearchParams();

  const flatListRef = useRef<FlatList>(null);
  const footerRef = useRef<View>(null); // 🔧 footer controlled without re-render

  // Keep tab bar visible on Android to prevent height jump/focus loss
  useEffect(() => {
    navigation.setOptions?.({
      tabBarHideOnKeyboard: Platform.OS === 'ios',
    } as any);
  }, [navigation]);

  const bottomPad = useBottomLiftTabs();

  // Tab bar size guess + safe area
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const tabH = useBottomTabBarHeight?.() || 0;
  const bpTab = height < 680 ? 56 : height < 780 ? 60 : height < 900 ? 64 : 72;
  const effectiveTab = tabH > 0 ? tabH : bpTab;

  // iOS uses KAV; Android does NOT (overlay + manual footer control)
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.bottom : 0;

  // Let content meet the white separator
  const contentBottomPad = 0;

  // Initial footer so last item clears the bar when keyboard is hidden
  const initialFooterHeight = Math.max(12, Math.round(effectiveTab));

  // Android: directly adjust footer height when keyboard shows/hides (no state)
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onShow = () => {
      footerRef.current?.setNativeProps({ style: { height: 0 } });
    };
    const onHide = () => {
      footerRef.current?.setNativeProps({ style: { height: initialFooterHeight } });
    };

    const sh = Keyboard.addListener('keyboardDidShow', onShow);
    const hd = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      sh.remove();
      hd.remove();
    };
  }, [initialFooterHeight]);

  const param = Array.isArray(code) ? code.join(',') : (code as string) || '';

  const fetchAllTradeItems = useCallback(async () => {
    try {
      let results: any[] = [];
      if (catalog === 'Electro') results = await fetchItemsByCode(param);
      else if (catalog === 'HandTools') results = await fetchToolsByCode(param);
      else if (catalog === 'Parts') results = await fetchPartsByCode(param);

      // 🔤 Sort items alphabetically by description (case-insensitive)
      results.sort((a, b) => {
        const da = (a?.description || '').toString().toLowerCase();
        const db = (b?.description || '').toString().toLowerCase();
        return da.localeCompare(db);
      });

      setTradeItems(results);
      setFilteredItems(results);
    } catch {
      Alert.alert('Ошибка', 'Ошибка запроса торговых позиций, нет связи с сервером.');
    } finally {
      setIsLoading(false);
    }
  }, [param, catalog]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllTradeItems();
    setRefreshing(false);
  }, [fetchAllTradeItems]);

  useEffect(() => {
    fetchAllTradeItems();
  }, [fetchAllTradeItems]);

  useEffect(() => {
    if (tradeItems.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ animated: true, offset: 0 });
      }, 100);
    }
  }, [tradeItems]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      setFilteredItems(
        tradeItems.filter(
          (item) =>
            item.article?.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q)
        )
      );
    } else {
      setFilteredItems(tradeItems);
    }
  }, [searchQuery, tradeItems]);

  useEffect(() => {
    setSearchQuery('');
  }, [code, catalog, hierarchy]);

  const searchKey = useMemo(
    () => `search-${catalog ?? ''}-${param ?? ''}-${hierarchy ?? ''}`,
    [catalog, param, hierarchy]
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <PictureUri
        item={item}
        onPress={() => {
          Toast.show({
            type: 'success',
            text1: 'Товар добавлен в корзину',
            position: 'top',
            visibilityTime: 2500,
            topOffset: 80,
          });
        }}
      />
    ),
    []
  );

  const Header = () => (
    <View className="bg-primary px-4 pt-2 pb-3">
      <Text
        className="text-lg font-psemibold text-white text-center"
        // allow multi-line wrapping
        style={{ flexShrink: 1, flexWrap: 'wrap', alignSelf: 'center' }}
      >
        {String(hierarchy || '')}
      </Text>
      <View className="mt-3">
        <SearchInput
          key={searchKey}
          initialQuery={searchQuery}
          placeholder="поиск по элементам папки"
          onSubmit={setSearchQuery}
        />
      </View>
    </View>
  );

  // Footer view controlled imperatively (prevents re-render/focus loss)
  const ListFooter = () => (
    <View ref={footerRef} style={{ height: initialFooterHeight }} />
  );

  const Content = (
    <>
      <Header />
      <FlatList
        ref={flatListRef}
        style={{ flex: 1 }}
        data={filteredItems.filter((i) => i.price !== 0)}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={() => (
          <EmptyState
            title="Элементы не найдены"
            subtitle="Выберите категорию для отображения элементов"
          />
        )}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: contentBottomPad }}
        ListFooterComponent={ListFooter}
        // Keep this constant; changing it dynamically can trigger unwanted layout cycles
        scrollIndicatorInsets={{ bottom: initialFooterHeight }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        removeClippedSubviews={false}
      />
    </>
  );

  return (
    // Bottom edge excluded — tab bar already handles safe area
    <SafeAreaView className="bg-primary flex-1" edges={['top', 'left', 'right']}>
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          {Content}
        </KeyboardAvoidingView>
      ) : (
        // Android: no KAV — avoid extra padding when keyboard shows
        <View style={{ flex: 1 }}>{Content}</View>
      )}
    </SafeAreaView>
  );
};

export default Elements;
