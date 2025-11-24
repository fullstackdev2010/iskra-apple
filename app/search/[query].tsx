// app/search/[query].tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../components/EmptyState';
import PictureUri from '../../components/PictureUri';
import { useLocalSearchParams } from 'expo-router';
import SearchInput from '../../components/SearchInput';
import { useBottomLiftStandalone } from '../../lib/useBottomLift';
import { router } from 'expo-router';
import useCartStore from '../store/cartStore';

import {
  searchTradeItemsItems,
  searchTradeItemsTools,
  searchCombinedTradeItemsParts,
} from '../../lib/trade';

interface Item {
  id: number;
  code: string;
  article: string;
  description: string;
  stock: string;
  price: number;
  picture?: string;
}

const Search = () => {
  const { query, catalog, source, showUnavailable } = useLocalSearchParams();
  const [finalData, setFinalData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const bottomPad = useBottomLiftStandalone();

  const allowZero = (() => {
    const getParam = (p: any) => (Array.isArray(p) ? p[0] : p);
    const s = getParam(source);
    const su = String(getParam(showUnavailable) ?? '').toLowerCase();
    return s === 'orders' || su === '1' || su === 'true';
  })();

  const normalizedQuery = Array.isArray(query) ? query.join(',') : (query || '');
  const normalizedCatalog = (() => {
    const raw = (Array.isArray(catalog) ? catalog[0] : catalog) || '';
    const norm = String(raw).toLowerCase();
    return norm === 'electro' || norm === 'items' ? 'Electro'
      : norm === 'handtools' || norm === 'tools' ? 'HandTools'
      : norm === 'parts' ? 'Parts'
      : 'ALL';
  })();

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        let data: Item[] = [];
        if (normalizedCatalog === 'Electro') {
          const raw = await searchTradeItemsItems(normalizedQuery);
          data = raw.map(item => ({
            ...item,
            description: item.description ?? '',
            stock: String(item.stock),
            picture: item.picture,
          }));
        } else if (normalizedCatalog === 'HandTools') {
          const raw = await searchTradeItemsTools(normalizedQuery);
          data = raw.map(item => ({
            ...item,
            description: item.description ?? '',
            stock: String(item.stock),
            picture: item.picture,
          }));
        } else if (normalizedCatalog === 'Parts') {
          const raw = await searchCombinedTradeItemsParts(normalizedQuery);
          data = raw.map(item => ({
            ...item,
            description: item.description ?? '',
          }));
        } else {
          const [el, ht, pr] = await Promise.all([
            searchTradeItemsItems(normalizedQuery).catch(() => []),
            searchTradeItemsTools(normalizedQuery).catch(() => []),
            searchCombinedTradeItemsParts(normalizedQuery).catch(() => []),
          ]);
          const map = new Map<string, any>();
          const pushAll = (arr: any[]) => arr.forEach((it: any) => {
            const code = String(it.code ?? it.id ?? Math.random());
            if (!map.has(code)) map.set(code, it);
          });
          pushAll(el); pushAll(ht); pushAll(pr);
          data = Array.from(map.values()).map((item: any) => ({
            ...item,
            description: item.description ?? '',
            stock: String(item.stock ?? ''),
            picture: item.picture,
          }));
        }
        setFinalData(data);
        requestAnimationFrame(() => listRef.current?.scrollToOffset({ animated: false, offset: 0 }));
      } catch (err) {
        console.error('Search failed:', err);
        setFinalData([]);
      }
      setLoading(false);
    };
    fetch();
  }, [normalizedQuery, normalizedCatalog]);

  if (loading) {
    return (
      <SafeAreaView className="bg-primary flex-1 items-center justify-center">
        <Text className="text-white">Загрузка...</Text>
      </SafeAreaView>
    );
  }

  const Header = () => {
    const { cartCount } = useCartStore();
    return (
      <View className="bg-primary px-4 pt-2 pb-3">
        {/* Wrapping title (no clipping) */}
        <Text
          className="text-2xl font-psemibold text-white text-center"
          style={{ flexShrink: 1, flexWrap: 'wrap', alignSelf: 'center' }}
        >
          {normalizedQuery}
        </Text>

        {/* Search + Cart (emoji) row */}
        <View className="mt-3" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <SearchInput
              key={`search-${normalizedCatalog}-${normalizedQuery}`}
              initialQuery={normalizedQuery}
              catalog={Array.isArray(catalog) ? catalog[0] : (catalog as string)}
            />
          </View>
          <TouchableOpacity
            onPress={() => router.push('/cart')}
            style={{ marginLeft: 12, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Открыть корзину"
          >
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 26, lineHeight: 26 }}>🛒</Text>
              {cartCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    right: -6,
                    top: -4,
                    backgroundColor: '#FF9C01',  // match tab badge color
                    borderRadius: 10,
                    width: 16,
                    height: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                    {cartCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="bg-primary flex-1">
      <Header />
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={finalData.filter((i) => i.price !== 0)}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => <PictureUri item={item} allowZero={allowZero} />}
        ListEmptyComponent={() => (
          <EmptyState title="Элементов не найдено" subtitle="Попробуйте изменить запрос" />
        )}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 4, paddingBottom: bottomPad }}
      />
    </SafeAreaView>
  );
};

export default Search;
