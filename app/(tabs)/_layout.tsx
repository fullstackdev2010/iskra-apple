// app/(tabs)/_layout.tsx
import React from 'react'
import { View, Text, Image, ImageSourcePropType, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import useCartStore from '../store/cartStore'
import { icons } from '../../constants'
import OfflineBanner from '../../components/OfflineBanner'

interface Props {
  icon: ImageSourcePropType;
  color: string;
  focused: boolean;
  badgeCount?: number;
}

const TabIcon = ({ icon, color, focused, badgeCount = 0 }: Props) => {
  return (
    <View className='items-center justify-center gap-2'>
      <Image source={icon} resizeMode='contain' tintColor={color} className='w-6 h-6' />
      {badgeCount > 0 && (
        <View
          style={{
            position: 'absolute',
            right: -6,
            top: -4,
            backgroundColor: '#FF9C01',
            borderRadius: 10,
            width: 16,
            height: 16,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{badgeCount}</Text>
        </View>
      )}
    </View>
  )
}

// Helper: defensively compute the REAL count = sum of all quantities
const useCartTotalCount = (): number => {
  return useCartStore((state: any) => {
    const list: any[] = Array.isArray(state?.cart)
      ? state.cart
      : (Array.isArray(state?.items) ? state.items : []);
    return list.reduce((sum, it) => {
      const q = Number((it && (it.quantity ?? it.qty ?? 0)) || 0);
      return sum + (isNaN(q) ? 0 : q);
    }, 0);
  });
};

const TabsLayoutInner = () => {
  const insets = useSafeAreaInsets();
  const BAR_HEIGHT = 60 + insets.bottom;
  const OVERLAP = 6; // cover any seam above the bar

  // ✅ Compute once at component level (hook rules safe):
  const totalCount = useCartTotalCount();

  return (
    <>
      <StatusBar style="light" />

      {/* Wrapper provides scene background without sceneContainerStyle (avoids TS errors) */}
      <View style={{ flex: 1, backgroundColor: '#161622' }}>
        {/* Global offline indicator */}
        <OfflineBanner />
        <Tabs
          // Make Android Back go to previously used tab
          backBehavior="history"
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: true,
            tabBarActiveTintColor: '#FFA001',
            tabBarInactiveTintColor: '#CDCDE0',

            // ✅ Keep bar visible on Android to prevent keyboard flicker/height jump.
            //    iOS can still hide the bar with the keyboard.
            tabBarHideOnKeyboard: Platform.OS === 'ios',

            tabBarStyle: {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'transparent', // background drawn below
              height: 60 + insets.bottom,
              elevation: 0,
              shadowOpacity: 0,
              borderTopWidth: 0, // we draw our own separator
            },

            // White separator + slight upward overlap to hide any seam
            tabBarBackground: () => (
              <View style={{ flex: 1 }}>
                <View style={{ flex: 1, backgroundColor: '#161622' }} />
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: -OVERLAP,
                    height: OVERLAP,
                    backgroundColor: '#161622',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: -2,      // just above the bar
                    height: 2,    // thicker line like in cart
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </View>
            ),

            tabBarLabelStyle: { fontSize: 12, textAlign: 'center' },
            tabBarItemStyle: { width: 'auto', marginTop: 0 },
          }}
        >
          <Tabs.Screen
            name='home'
            options={{
              title: 'Категории',
              tabBarIcon: ({ color, focused }) => (
                <TabIcon icon={icons.home} color={color} focused={focused} />
              ),
            }}
          />
          <Tabs.Screen
            name='elements'
            options={{
              title: 'Элементы',
              tabBarIcon: ({ color, focused }) => (
                <TabIcon icon={icons.elements} color={color} focused={focused} />
              ),
            }}
          />
          <Tabs.Screen
            name="cart"
            options={{
              title: 'Корзина',
              // Use the precomputed totalCount to avoid calling hooks in this inline function
              tabBarIcon: ({ color, focused }) => (
                <TabIcon
                  icon={icons.cart}
                  color={color}
                  focused={focused}
                  badgeCount={totalCount}
                />
              ),
            }}
          />
          <Tabs.Screen
            name='orders'
            options={{
              title: 'Заказы',
              tabBarIcon: ({ color, focused }) => (
                <TabIcon icon={icons.plus} color={color} focused={focused} />
              ),
            }}
          />
          <Tabs.Screen
            name='profile'
            options={{
              title: 'Менеджер',
              tabBarIcon: ({ color, focused }) => (
                <TabIcon icon={icons.profile} color={color} focused={focused} />
              ),
            }}
          />
        </Tabs>
      </View>
    </>
  )
}

const TabsLayout = () => (
  <SafeAreaProvider>
    <TabsLayoutInner />
  </SafeAreaProvider>
)

export default TabsLayout
