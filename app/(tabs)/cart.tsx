// app/(tabs)/cart.tsx
import React, { useMemo, useState } from 'react';
import { Text, FlatList, View, Alert, Image, useWindowDimensions } from 'react-native';
import useCartStore from '../../app/store/cartStore';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomButton from '../../components/CustomButton';
import { useGlobalContext } from '../../context/GlobalProvider';
import { createOrder } from '../../lib/api';
import { router } from 'expo-router';
import { images } from '../../constants';
import { API_HOST } from '../../lib/constants';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';

export default function Cart() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight?.() || 0;
  const { height } = useWindowDimensions();

  // Breakpoint fallback if tab height isn't provided (rare transient)
  const bpTab = height < 680 ? 56 : height < 780 ? 60 : height < 900 ? 64 : 72;

  // Anchor the footer exactly to the tab bar (no added cushions).
  // Fallback to safe-area bottom (or baseline) if tab height is 0.
  const overlayBottom = Math.ceil(
    tabBarHeight > 0 ? tabBarHeight : Math.max(insets.bottom, bpTab)
  );

  // Measure footer height so the list can pad/spacer accordingly
  const [footerH, setFooterH] = useState(0);

  const { user } = useGlobalContext();
  const {
    cart,
    removeFromCart,
    clearCart,
    incrementQuantity,
    decrementQuantity,
  } = useCartStore();

  const roundUpToNearest5 = (value: number): number => Math.ceil(value / 5) * 5;

  function parseStockLimit(stock: string): number {
    if (!stock) return 0;
    const n = parseInt(stock);
    if (!isNaN(n)) return n;
    if (stock === '>10') return 100;
    if (stock === '>100') return 200;
    if (stock.toLowerCase() === 'много') return 300;
    return 0;
  }

  // ⛔️ Do not recompute prices here. Cart prices are final snapshots chosen in ItemCard.
  const getAdjustedPrice = (price: number): number => price;

  const handleIncrease = (code: string) => {
    const item = cart.find(i => i.code === code);
    if (!item) return;
    const maxQty = parseStockLimit(item.stock);
    if (item.quantity >= maxQty) {
      Alert.alert('Превышение', 'Вы достигли лимита по доступному остатку.');
      return;
    }
    incrementQuantity(code);
  };

  const submitOrder = async () => {
    // Hard stop: do nothing if cart is empty
    if (!cart || cart.length === 0) return;

    // Split by price type (default unknown -> regular)
    const regularGroup = cart.filter((i: any) => i?.priceType !== 'special');
    const specialGroup = cart.filter((i: any) => i?.priceType === 'special');

    // Helper: map a group to API payload
    // `ot` = 1 (regular) | 2 (special)
    const toPayload = (arr: any[], ot: 1 | 2) => {
      const items = arr.map((item) => ({
        code: item.code,
        article: item.article || '',
        description: item.description || '',
        // final price snapshot already chosen in ItemCard
        price: Number(item.price),
        quantity: Number(item.quantity),
      }));
      return {
        sum: items.reduce((s, it) => s + it.price * it.quantity, 0),
        items,
        order_type: ot,
      };
    };

    // Helper: remove a successful group from cart
    const removeGroupFromCart = (arr: any[]) => {
      arr.forEach((it) => removeFromCart(it.code));
    };

    try {
      // If we have both groups, send two orders sequentially
      if (regularGroup.length > 0 && specialGroup.length > 0) {
        await createOrder(toPayload(regularGroup, 1));
        removeGroupFromCart(regularGroup);

        await createOrder(toPayload(specialGroup, 2));
        removeGroupFromCart(specialGroup);

        Alert.alert('Искра Юг', 'Спасибо, Ваши два заказа переданы менеджеру!');
        router.push('/orders');
        return;
      }

      // Otherwise, send the single existing group
      const isSpecialOnly = specialGroup.length > 0 && regularGroup.length === 0;
      const group = isSpecialOnly ? specialGroup : regularGroup;
      await createOrder(toPayload(group, isSpecialOnly ? 2 : 1));
      removeGroupFromCart(group);
      Alert.alert('Искра Юг', 'Спасибо, Ваш заказ передан менеджеру!');
      router.push('/orders');
    } catch (error: any) {
      // If any step fails, we keep whatever items weren't removed in the cart
      Alert.alert('Ошибка', 'Не удалось создать один из заказов. Товары остались в корзине.');
    }
  };

  const handleCreateOrder = () => {
    // Early exit if empty (guard remains as-is)
    if (!cart || cart.length === 0) return;

    Alert.alert(
      'Подтверждение',
      'Отправить заказ менеджеру?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отправить',
          onPress: () => { void submitOrder(); },
        },
      ]
    );
  };

  const totalSum = useMemo(
    () => roundUpToNearest5(cart.reduce((s, i) => s + i.price * i.quantity, 0)),
    [cart]
  );

  const Header = () => (
    <View className="bg-primary px-4 pb-3 pt-2">
      <View className="flex-row items-center justify-center">
        <Text className="text-xl font-psemibold text-white text-center">Новый Заказ</Text>
        <Image source={images.logoSmall} className="w-9 h-10 ml-3" resizeMode="contain" />
      </View>
    </View>
  );

  const Footer = () => {
    // Hide footer entirely if cart is empty (prevents empty orders)
    if (!cart || cart.length === 0) return null;

    return (
      <View
        className="bg-primary border-t border-white pt-3 px-3"
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: overlayBottom,  // exact anchor to tab bar / safe area
          zIndex: 20,
          elevation: 20,
        }}
      >
        <Text className="text-xl font-pregular text-white text-center">
          Общая сумма: {totalSum}₽
        </Text>
        <View className="mt-3">
          <CustomButton
            title="Создать и отправить заказ"
            handlePress={handleCreateOrder}
            containerStyles="border-4 border-red-700 mb-5"
            textStyles="text-xl"
          />
        </View>
      </View>
    );
  };

  if (cart.length === 0) {
    return (
      <SafeAreaView className="bg-primary flex-1">
        <Header />
        <View style={{ flex: 1, position: 'relative' }}>
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-xl font-psemibold text-white text-center">
              Для создания заказа добавьте товары в корзину
            </Text>
          </View>
          {/* Footer is not rendered when empty */}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-primary flex-1">
      <Header />
      <View style={{ flex: 1, position: 'relative' }}>
        <FlatList
          style={{ flex: 1 }}
          data={cart}
          keyExtractor={(item) => item.code}
          renderItem={({ item, index }) => {
            const maxQty = parseStockLimit(item.stock);
            const disablePlus = item.quantity >= maxQty;

            const isAbs = (item.picture || '').startsWith('http');
            const thumbUri = item.picture
              ? (isAbs ? item.picture : `${API_HOST}/pictures/${item.picture}`)
              : null;

            return (
              <View style={{ marginHorizontal: 12, marginVertical: 8 }}>
                <View className="flex-row items-start mt-1">
                  <Text className="text-xl font-pregular text-white mr-2 self-start">
                    {index + 1}.
                  </Text>

                  {thumbUri ? (
                    <Image source={{ uri: thumbUri }} className="w-24 h-24 mr-3 rounded-2xl self-start" resizeMode="contain" />
                  ) : (
                    <Image source={images.no_photo} className="w-24 h-24 mr-3 rounded-2xl self-start" resizeMode="contain" />
                  )}

                  <View className="flex-1 pr-2 self-start" style={{ flexShrink: 1 }}>
                    <Text className="text-lg font-psemibold text-white">{item.article}</Text>
                    <Text className="text-lg font-pregular text-white opacity-80">{item.description}</Text>
                  </View>
                </View>

                {/* Centered inline group: Цена, -, qty, + */}
                <View className="flex-row items-center justify-center mt-3">
                  {(() => {
                    const isSpecial = String((item as any)?.priceType || 'regular') === 'special';
                    return (
                      <View className="flex-row items-center mr-3">
                        <Text
                          className="text-xl font-pregular mr-2"
                          style={[{ color: '#ffffff' }, isSpecial && { color: '#D35400' }]}
                        >
                          Цена{isSpecial ? ' (акция)' : ''}: {item.price}₽
                        </Text>
                        
                      </View>
                    );
                  })()}

                  <CustomButton
                    title="-"
                    handlePress={() => decrementQuantity(item.code)}
                    containerStyles="ml-1 mr-2 w-14 h-12 border-2 border-red-700 rounded-full"
                    textStyles="text-xl"
                  />

                  <Text className="text-xl font-pregular text-white mx-2">{item.quantity}</Text>

                  <CustomButton
                    title="+"
                    handlePress={() => handleIncrease(item.code)}
                    containerStyles={`ml-2 w-14 h-12 ${disablePlus ? 'bg-gray-600 opacity-50' : 'bg-green-600'} border-2 border-red-700 rounded-full`}
                    textStyles="text-xl"
                    isLoading={false}
                  />
                </View>

                <CustomButton
                  title="Удалить из заказа"
                  handlePress={() => removeFromCart(item.code)}
                  containerStyles="mt-3 mb-1 border-4 border-red-700"
                  textStyles="text-xl"
                />
              </View>
            );
          }}
          // Spacer equals the overlay area so nothing scrolls under the footer
          ListFooterComponent={<View style={{ height: footerH + overlayBottom + 12 }} />}
          contentContainerStyle={{ paddingTop: 4 }}
          removeClippedSubviews={false}
        />
        <Footer />
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({});