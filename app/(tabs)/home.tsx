// app/(tabs)/home.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Alert, RefreshControl, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { images } from '../../constants';
import SearchInput from '../../components/SearchInput';
import { useGlobalContext } from '../../context/GlobalProvider';
import { Provider as PaperProvider, ActivityIndicator, List, MD3DarkTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  getHierarchyByCodeItems,
  getHierarchyByCodeTools,
  getCombinedHierarchyByCodeParts,
} from '../../lib/trade';
import axios from 'axios';
import { API_HOST } from '../../lib/constants';
import { useBottomLiftTabs } from '../../lib/useBottomLift';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

type CatalogKind = 'Electro' | 'HandTools' | 'Parts';

type HierarchyEntry = {
  code: string;
  title: string;
  data: any[];              // preloaded flat rows (code/parentId structure)
  hasChildFolders: boolean; // immediate child folders exist
};

type Hierarchy20DetailsLinkProps = {
  entries: HierarchyEntry[];
  catalog: CatalogKind;
};

const isOldAndroid = Platform.OS === 'android' && (Platform.Version as number) < 28;

// ---------- helpers (code / parentId flat) ----------
const asStr = (v: any) => String(v ?? '').trim();

const isFolderFlat = (n: any) =>
  n &&
  Number(n?.price ?? 0) === 0 &&
  String(n?.stock ?? '0') === '0' &&
  (!n?.article || n.article === '');

const isItemFlat = (n: any) => !isFolderFlat(n);

const getNodeTitle = (node: any) =>
  node?.title || node?.name || node?.description || node?.code || '';

/** Direct children of a given parent code */
const getDirectChildren = (rows: any[], parentCode: string) =>
  (rows || []).filter((r) => asStr(r.parentId) === asStr(parentCode));

/**
 * Direct child folders of parent, ordered how users expect:
 * 1) case-insensitive title
 * 2) shorter title first (helps "БУРЫ HITACHI" come before "Буры, сверла, …")
 * 3) code
 * 4) original position (stable)
 */
const getChildFolderNodesForParent = (rows: any[], parentCode: string) => {
  type Node = { code: string; title: string; pos: number };
  const out: Node[] = [];
  for (let i = 0; i < (rows?.length ?? 0); i++) {
    const r = rows[i];
    if (asStr(r?.parentId) === asStr(parentCode) && isFolderFlat(r)) {
      const code = asStr(r.code);
      if (code) out.push({ code, title: getNodeTitle(r), pos: i });
    }
  }
  const ci = (s: string) => s.toLowerCase();
  out.sort((a, b) =>
    (ci(a.title) < ci(b.title) ? -1 : ci(a.title) > ci(b.title) ? 1 : 0) ||
    (a.title.length - b.title.length) ||
    (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) ||
    (a.pos - b.pos)
  );
  return out.map(({ code, title }) => ({ code, title }));
};

const hasDirectItems = (rows: any[], parentCode: string) =>
  getDirectChildren(rows, parentCode).some(isItemFlat);

// ---------- UI: folders are links with drill-down ----------
const Hierarchy20DetailsLink: React.FC<Hierarchy20DetailsLinkProps> = ({ entries, catalog }) => {
  const router = useRouter();
  const [openingCode, setOpeningCode] = useState<string | null>(null);

  const fetchHierarchy = useCallback(async (code: string) => {
    if (catalog === 'Electro') return await getHierarchyByCodeItems('parentId', code);
    if (catalog === 'HandTools') return await getHierarchyByCodeTools('parentId', code);
    return await getCombinedHierarchyByCodeParts('parentId', code);
  }, [catalog]);

  /**
   * BFS to the first folder that has DIRECT items.
   * Root may use its preloaded startData; deeper nodes use their own rows (or fetch).
   * Children are explored in user-facing order (see sorter above).
   */
  const findFirstNonEmptyTarget = useCallback(
    async (startCode: string, startData: any[] | undefined, startTitle: string, maxDepth = 6) => {
      type Node = { code: string; title: string; data?: any[]; depth: number };
      const q: Node[] = [{ code: startCode, title: startTitle, data: startData, depth: 0 }];
      const seen = new Set<string>([startCode]);

      while (q.length) {
        const { code, title, data, depth } = q.shift() as Node;
        const isRoot = code === startCode;

        let rows: any[] | undefined = Array.isArray(data) ? data : undefined;
        if (isRoot && !rows && Array.isArray(startData)) rows = startData;
        if (!rows) rows = await fetchHierarchy(code);

        if (hasDirectItems(rows, code)) return { code, title };

        if (depth >= maxDepth) continue;

        const children = getChildFolderNodesForParent(rows, code);
        for (const ch of children) {
          if (!seen.has(ch.code)) {
            seen.add(ch.code);
            q.push({ code: ch.code, title: ch.title || ch.code, depth: depth + 1 });
          }
        }
      }
      return { code: startCode, title: startTitle };
    },
    [fetchHierarchy]
  );

  return (
    <View style={{ backgroundColor: '#161622', borderWidth: 1, borderColor: '#ffffff', borderRadius: 8, overflow: 'hidden' }}>
      <List.Section style={{ backgroundColor: '#161622', margin: 0, padding: 0 }}>
        {entries.map((entry, idx) => {
          const tinted = entry.hasChildFolders;
          return (
            <List.Item
              key={`${catalog}-${idx}-${entry.code}`}
              // Render title as a Text node to allow multi-line wrapping
              title={() => (
                <Text style={{ color: '#f2ad70', flexShrink: 1, flexWrap: 'wrap' }}>
                  {entry.title}
                </Text>
              )}
              onPress={async () => {
                try {
                  setOpeningCode(entry.code);
                  const { code: targetCode, title: targetTitle } =
                    await findFirstNonEmptyTarget(entry.code, entry.data, entry.title, 6);

                  router.push({
                    pathname: '/elements',
                    params: { code: targetCode, catalog, hierarchy: targetTitle },
                  });
                } catch {
                  Alert.alert('Ошибка', 'Не удалось открыть раздел.');
                } finally {
                  setOpeningCode(null);
                }
              }}
              left={(props) => (
                <List.Icon {...props} color={tinted ? '#709bf2' : '#ffffff'} icon="folder" />
              )}
              right={(props) =>
                openingCode === entry.code ? (
                  <ActivityIndicator animating size="small" color="#709bf2" />
                ) : (
                  <List.Icon {...props} color="#709bf2" icon="arrow-right" />
                )
              }
              style={{
                backgroundColor: tinted ? '#1c1f2a' : '#161622',
                margin: 0,
                elevation: isOldAndroid ? 0 : 0,
                borderBottomColor: '#232533',
                borderBottomWidth: 1,
                borderLeftWidth: tinted ? 3 : 0,
                borderLeftColor: tinted ? '#709bf2' : 'transparent',
                 // keep some room so right icon doesn't clip long text
                paddingRight: 8,
              }}
            />
          );
        })}
      </List.Section>
    </View>
  );
};

// ---------- misc ----------
const shallowEqualArr = (a: any[], b: any[]) =>
  a === b || (a.length === b.length && a.every((v, i) => v === b[i]));

const categoriesEqual = (a: any[], b: any[]) =>
  a === b ||
  (a.length === b.length &&
    a.every((v, i) => v.code === b[i].code && v.title === b[i].title && v.description === b[i].description));

const REFETCH_TTL_MS = 5 * 60 * 1000;

const BigRoundSpinner = ({ label = 'Загрузка…' }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
    <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#161622', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator animating size="large" color="#709bf2" />
    </View>
    <Text style={{ color: '#fff', marginTop: 16 }}>{label}</Text>
  </View>
);

const Home = () => {
  const { user } = useGlobalContext();
  const [catalog, setCatalog] = useState<CatalogKind>('Electro');
  const [categories, setCategories] = useState<any[]>([]);
  const [catCodesItems, setCatCodesItems] = useState<string[]>([]);
  const [catCodesTools, setCatCodesTools] = useState<string[]>([]);
  const [catCodesParts, setCatCodesParts] = useState<string[]>([]);
  const [catDataItems, setCatDataItems] = useState<any[]>([]);
  const [catDataTools, setCatDataTools] = useState<any[]>([]);
  const [catDataParts, setCatDataParts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCategoriesFetchAt, setLastCategoriesFetchAt] = useState<number>(0);

  const paperTheme = useMemo(() => ({
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      background: '#161622',
      surface: '#161622',
      surfaceVariant: '#1c1f2a',
      primary: '#709bf2',
      secondary: '#f2ad70',
      onSurface: '#ffffff',
      outline: '#232533',
    },
    elevation: { level0: 0, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 },
  }), []);

  const bottomPad = useBottomLiftTabs();
  const { height } = useWindowDimensions();
  const tabH = useBottomTabBarHeight?.() || 0;
  const bpTab = height < 680 ? 56 : height < 780 ? 60 : height < 900 ? 64 : 72;
  const effectiveTab = tabH > 0 ? tabH : bpTab;

  const fetchCategories = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!force && lastCategoriesFetchAt && Date.now() - lastCategoriesFetchAt < REFETCH_TTL_MS) return;
      try {
        const res = await axios.get(`${API_HOST}/categories`, { params: { ts: Date.now() } });
        const all = res.data as any[];

        const nextItems = all.filter((c) => c.title === 'Items').map((c) => c.code);
        const nextTools = all.filter((c) => c.title === 'Tools').map((c) => c.code);
        const nextParts = all.filter((c) => c.title === 'Parts').map((c) => c.code);

        if (!categoriesEqual(categories, all)) setCategories(all);
        if (!shallowEqualArr(catCodesItems, nextItems)) setCatCodesItems(nextItems);
        if (!shallowEqualArr(catCodesTools, nextTools)) setCatCodesTools(nextTools);
        if (!shallowEqualArr(catCodesParts, nextParts)) setCatCodesParts(nextParts);

        setLastCategoriesFetchAt(Date.now());
      } catch {
        Alert.alert('Ошибка', 'Не удалось загрузить категории, нет связи с сервером.');
      }
    },
    [lastCategoriesFetchAt, categories, catCodesItems, catCodesTools, catCodesParts]
  );

  useEffect(() => { fetchCategories({ force: true }); }, []); // eslint-disable-line
  useFocusEffect(useCallback(() => { fetchCategories({ force: false }); return () => {}; }, [fetchCategories]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCategories({ force: true });
    setRefreshing(false);
  }, [fetchCategories]);

  useEffect(() => {
    if (catalog === 'Electro') {
      setCatDataItems(catCodesItems.map(() => ({ data: [], isLoading: true })));
      Promise.all(catCodesItems.map(code => getHierarchyByCodeItems('parentId', code)))
        .then(responses => setCatDataItems(responses.map(r => ({ data: r, isLoading: false })) ))
        .catch(() => {
          Alert.alert('Ошибка','Не удалось загрузить электроинструмент.');
          setCatDataItems(catCodesItems.map(() => ({ data: [], isLoading: false })));
        });
    } else if (catalog === 'HandTools') {
      setCatDataTools(catCodesTools.map(() => ({ data: [], isLoading: true })));
      Promise.all(catCodesTools.map(code => getHierarchyByCodeTools('parentId', code)))
        .then(responses => setCatDataTools(responses.map(r => ({ data: r, isLoading: false })) ))
        .catch(() => {
          Alert.alert('Ошибка','Не удалось загрузить ручной инструмент.');
          setCatDataTools(catCodesTools.map(() => ({ data: [], isLoading: false })));
        });
    } else if (catalog === 'Parts') {
      setCatDataParts(catCodesParts.map(() => ({ data: [], isLoading: true })));
      Promise.all(catCodesParts.map(code => getCombinedHierarchyByCodeParts('parentId', code)))
        .then(responses => setCatDataParts(responses.map(r => ({ data: r, isLoading: false }))  ))
        .catch(() => {
          Alert.alert('Ошибка','Не удалось загрузить запчасти.');
          setCatDataParts(catCodesParts.map(() => ({ data: [], isLoading: false })));
        });
    }
  }, [catalog, catCodesItems, catCodesTools, catCodesParts]);

  const isLoading = useMemo(() => {
    if (catalog === 'Electro') return catDataItems.some(item => item.isLoading);
    if (catalog === 'HandTools') return catDataTools.some(item => item.isLoading);
    if (catalog === 'Parts') return catDataParts.some(item => item.isLoading);
    return false;
  }, [catalog, catDataItems, catDataTools, catDataParts]);

  const catalogContent = useMemo(() => {
    if (isLoading) return <BigRoundSpinner label="Загрузка каталога…" />;

    let entries: HierarchyEntry[] = [];

    const buildEntries = (
      titleFilter: 'Items' | 'Tools' | 'Parts',
      codes: string[],
      dataArray: { data: any[]; isLoading: boolean }[]
    ) => {
      const dataMap = new Map(codes.map((code, i) => [code, dataArray[i]]));
      return (categories
        .filter((c: any) => c.title === titleFilter)
        .sort((a: any, b: any) => a.id - b.id)
        .map((c: any) => {
          const pack = dataMap.get(c.code);
          const data = pack?.data ?? [];
          if ((data?.length ?? 0) === 0) return null;

          const hasChildFolders = getChildFolderNodesForParent(data, c.code).length > 0;

          return { code: c.code, title: c.description || c.code, data, hasChildFolders } as HierarchyEntry;
        })
        .filter(Boolean)) as HierarchyEntry[];
    };

    if (catalog === 'Electro') entries = buildEntries('Items', catCodesItems, catDataItems);
    else if (catalog === 'HandTools') entries = buildEntries('Tools', catCodesTools, catDataTools);
    else if (catalog === 'Parts') entries = buildEntries('Parts', catCodesParts, catDataParts);

    if (!entries.length) return <BigRoundSpinner label="Загрузка каталога…" />;

    return (
      <PaperProvider theme={paperTheme}>
        <Hierarchy20DetailsLink catalog={catalog} entries={entries} />
      </PaperProvider>
    );
  }, [
    isLoading,
    catalog,
    categories,
    catCodesItems,
    catCodesTools,
    catCodesParts,
    catDataItems,
    catDataTools,
    catDataParts,
    paperTheme,
  ]);

  return (
    <SafeAreaView className="bg-primary h-full" edges={['top','left','right']}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View className="my-6 px-4 space-y-6">
          <View className="justify-between items-start flex-row mb-3">
            <View>
              <Text className="font-pmedium text-md text-gray-100">Добро пожаловать,</Text>
              <Text className="mb-2 text-xl font-psemibold text-white">{user?.username || "Новый Пользователь"}</Text>
            </View>
            <View className="mt-1.5">
              <Image source={images.logoSmall} className="w-9 h-10" resizeMode="contain" />
            </View>
          </View>

          <SearchInput initialQuery="" catalog={catalog} />

          <Text className="font-pmedium text-md text-gray-100 mt-5">Выберите категорию:</Text>

          <View className="flex-row flex-wrap gap-3">
            {['Electro', 'HandTools', 'Parts'].map((type) => (
              <TouchableOpacity key={type} onPress={() => setCatalog(type as CatalogKind)}>
                <Text className={`text-xl ${catalog === type ? 'text-[#709bf2] underline' : 'text-white'}`}>
                  {type === 'Electro' ? 'Электро' : type === 'HandTools' ? 'Ручной' : 'Запчасти'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Scrollable content */}
        <ScrollView
          className="mx-3 bg-primary text-white"
          contentContainerStyle={{ paddingTop: 4, paddingBottom: Math.max(4, bottomPad) }}
          scrollIndicatorInsets={{ bottom: Math.max(12, Math.round(effectiveTab)) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {catalogContent}
          <View style={{ height: Math.max(12, Math.round(effectiveTab)) }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default Home;
