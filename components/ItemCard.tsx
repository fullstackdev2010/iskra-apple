// components/ItemCard.tsx
import React, { useMemo, useState } from 'react';
import { Card, Title, Paragraph } from 'react-native-paper';
import { StyleSheet, View, Pressable, Modal, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import CustomButton from '../components/CustomButton';
import useCartStore from '../app/store/cartStore';
import { useGlobalContext } from '../context/GlobalProvider';
import { showTopToast } from '../lib/toast';

interface ItemCardProps {
  code: string;
  article: string;
  description: string;
  price: number;           // regular base price (raw)
  basePrice2?: number;     // special base price (акция), computed in PictureUri
  price2?: number;         // compatibility if basePrice2 isn't provided
  stock: string;
  picture: string;
  onPress?: () => void;
  allowZero?: boolean;
}

const ceilTo5 = (n: number) => Math.ceil(n / 5) * 5;

const parseStockLimit = (stock: string): number => {
  if (!stock) return 0;
  const n = parseInt(stock as any);
  if (!Number.isNaN(n)) return n;
  const s = (stock || '').toString().toLowerCase().trim();
  if (s === '>10') return 100;
  if (s === '>100') return 200;
  if (s === 'много') return 300;
  return 0;
};

const ItemCard: React.FC<ItemCardProps> = ({
  code,
  article,
  description,
  price,
  basePrice2,
  price2,
  stock,
  picture,
  onPress,
}) => {
  const { width, height } = useWindowDimensions();
  const cartState: any = (useCartStore() as any) ?? {};
  const addToCart: (item: any) => void = cartState?.addToCart ?? (() => {});
  const incrementQuantity: (code: string) => void = cartState?.incrementQuantity ?? (() => {});
  const decrementQuantity: (code: string) => void = cartState?.decrementQuantity ?? (() => {});
  const removeFromCart: (code: string) => void = cartState?.removeFromCart ?? (() => {});
  const itemsArr: any[] = Array.isArray(cartState?.items)
    ? cartState.items
    : (Array.isArray(cartState?.cart) ? cartState.cart : []);

  const { user } = useGlobalContext();

  // Regular price = price + discount
  const regularPrice = useMemo(() => {
    const d = Number(user?.discount || 0);
    return ceilTo5(price * (1 + d / 100));
  }, [price, user?.discount]);

  // Акция base preference: basePrice2 (from PictureUri) else price2 (compat)
  const akciaBase =
    basePrice2 !== undefined && basePrice2 !== null
      ? basePrice2
      : (typeof price2 === 'number' && Number.isFinite(price2) ? price2 : undefined);

  const hasSpecial = akciaBase !== undefined && akciaBase !== null && Number.isFinite(Number(akciaBase));

  // Акция price = base + discount2
  const specialPrice = useMemo(() => {
    if (!hasSpecial) return null;
    const d2 = Number(user?.discount2 || 0);
    return ceilTo5((akciaBase as number) * (1 + d2 / 100));
  }, [hasSpecial, akciaBase, user?.discount2]);

  // selection state
  const [selectedPrice, setSelectedPrice] = useState<'regular' | 'special' | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // --- Reanimated zoom/pan state (UI thread only) ---
  const baseScale = useSharedValue(1); // accumulated scale
  const scale = useSharedValue(1);     // live scale (baseScale * pinch)
  const tx = useSharedValue(0);        // live translate X
  const ty = useSharedValue(0);        // live translate Y
  
  // pan start positions (instead of using ctx)
  const panStartX = useSharedValue(0); const panStartY = useSharedValue(0);

  // Pinch gesture (clamped to 1x..8x)
  const pinch = Gesture.Pinch()
    .onChange((e) => {
      const next = Math.max(1, Math.min(baseScale.value * e.scale, 8));
      scale.value = next;
    })
    .onEnd(() => {
      baseScale.value = scale.value;
      // If back to ~1x, recenter
      if (baseScale.value <= 1.001) {
        baseScale.value = 1;
        scale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      }
    });

  // Pan gesture (only meaningful when zoomed in); with edge clamping
  const pan = Gesture.Pan()
    .onStart(() => {
      panStartX.value = tx.value;
      panStartY.value = ty.value;
    })
    .onChange((e) => {
      if (baseScale.value <= 1.001) return;
      const nx = panStartX.value + e.translationX;
      const ny = panStartY.value + e.translationY;
      const s = scale.value;
      const maxX = (width * (s - 1)) / 2;
      const maxY = (height * (s - 1)) / 2;
      tx.value = Math.max(-maxX, Math.min(nx, maxX));
      ty.value = Math.max(-maxY, Math.min(ny, maxY));
    });

  // Double-tap to toggle zoom 1x <-> 2x and recenter
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (baseScale.value > 1.001) {
        baseScale.value = 1;
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      } else {
        baseScale.value = 2;
        scale.value = withTiming(2);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      }
    });

  // (keep your doubleTap if you added it; otherwise this is fine)
  const combined = Gesture.Simultaneous(pinch, pan);

  // Animated style for image wrapper
  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: tx.value },
      { translateY: ty.value },
    ],
  }));

  const isOutOfStock = (() => {
    const raw = (stock ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
    return !raw || raw === '0' || raw === '0 шт' || raw === '0pcs' || raw === '0 pcs' || raw === '0шт';
  })();

  const baseItem = {
    code,
    article,
    description,
    price, // will be overridden with chosen price on add
    stock,
    picture,
    quantity: 0,
  };

  const handleAddToCart = () => {
    if (onPress) {
      onPress();
      return;
    }

    let chosen = regularPrice;

    if (hasSpecial) {
      if (selectedPrice === null) {
        showTopToast('info', 'Выберите цену', 'Перед добавлением в корзину выберите «Цена» или «Цена (акция)».');
        return;
      }
      chosen = selectedPrice === 'special' ? (specialPrice as number) : regularPrice;
    }

    const existing = itemsArr.find((i) => i?.code === code);
    if (existing && Number(existing.price) !== Number(chosen)) {
      showTopToast('error', 'Товар уже в корзине с другой ценой', 'Удалите товар из корзины или выберите ту же цену.');
      return;
    }

    // Persist chosen price type into cart so we can split orders later
    const priceType =
      hasSpecial
        ? (selectedPrice === 'special' ? 'special' : 'regular')
        : 'regular';

    addToCart({
      ...baseItem,
      price: chosen,
      priceType, // 'regular' | 'special'
    });
    showTopToast('success', 'Товар добавлен в корзину');
  };

  // Quantity controls
  const existing = itemsArr.find((i) => i?.code === code);
  const maxQty = parseStockLimit(stock);
  const disablePlus = existing ? Number(existing.quantity) >= maxQty : false;
  const notInCart = !existing;
  const plusDisabled = notInCart || disablePlus;
  const minusDisabled = notInCart;

  const handlePlus = () => {
    if (notInCart) {
      showTopToast('info', 'Сначала добавьте товар', 'Нажмите «Добавить», затем используйте +/−.');
      return;
    }
    if (disablePlus) {
      showTopToast('info', 'Превышение', 'Вы достигли лимита по доступному остатку.');
      return;
    }
    incrementQuantity(code);
  };

  const handleMinus = () => {
    if (notInCart) {
      showTopToast('info', 'Сначала добавьте товар', 'Нажмите «Добавить», затем используйте +/−.');
      return;
    }
    const qty = Number(existing?.quantity ?? 0);
    if (qty <= 1) {
      removeFromCart(code);
      showTopToast('info', 'Товар удалён из корзины');
      return;
    }
    decrementQuantity(code);
  };

  return (
    <Card style={{ margin: 8 }}>
      {/* Tap-to-preview image */}
      <Pressable onPress={() => setPreviewOpen(true)} accessibilityRole="imagebutton" hitSlop={6}>
        <Card.Cover
          source={picture ? { uri: picture } : require('../assets/images/no_photo.jpg')}
          resizeMode="contain"
        />
      </Pressable>

      {/* Fullscreen preview modal with gestures */}
      <Modal
        visible={previewOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setPreviewOpen(false)}
        onShow={() => {
          // Reset transforms each time the modal opens (UI thread)
          baseScale.value = 1;
          scale.value = 1;
          tx.value = 0;
          ty.value = 0;
        }}
      >
        <GestureHandlerRootView style={styles.previewBackdrop} collapsable={false}>
          <GestureDetector gesture={combined}>
            <Animated.View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.Image
                source={picture ? { uri: picture } : require('../assets/images/no_photo.jpg')}
                style={[{ width, height }, imgStyle]}
                resizeMode="contain"
              />
            </Animated.View>
          </GestureDetector>
          <Pressable
            style={styles.previewClose}
            onPress={() => setPreviewOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть предпросмотр"
          >
            <Paragraph style={styles.previewCloseText}>✕</Paragraph>
          </Pressable>
        </GestureHandlerRootView>
      </Modal>

      <Card.Content>
        <Title style={styles.text_caption}>{article}</Title>
        <Paragraph style={styles.text_regular}>{description}</Paragraph>

        {!hasSpecial ? (
          <Paragraph style={styles.text_price}>
            Цена: {regularPrice}, Остаток: {stock}
          </Paragraph>
        ) : (
          <View style={{ marginTop: 8 }}>
            {/* Regular price line */}
            <Pressable
              onPress={() => setSelectedPrice('regular')}
              style={({ pressed }) => [
                styles.priceLine,
                selectedPrice === 'regular' && styles.priceLineSelected,
                pressed && styles.priceLinePressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedPrice === 'regular' }}
              hitSlop={6}
            >
              <Paragraph
                style={[
                  styles.text_price_row,
                  selectedPrice === 'regular' && styles.text_price_selected,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Цена: {regularPrice}
              </Paragraph>
            </Pressable>

            {/* empty line between prices */}
            <View style={styles.priceSpacer} />

            {/* Special price line */}
            <Pressable
              onPress={() => setSelectedPrice('special')}
              style={({ pressed }) => [
                styles.priceLine,
                styles.priceLineAkcia,
                selectedPrice === 'special' && styles.priceLineSelected,
                pressed && styles.priceLinePressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedPrice === 'special' }}
              hitSlop={6}
            >
              <Paragraph
                style={[
                  styles.text_price_row,
                  styles.text_price_akcia,
                  selectedPrice === 'special' && styles.text_price_selected,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Цена (акция): {specialPrice}
              </Paragraph>
            </Pressable>
            {/* empty line */}
            <View style={styles.priceSpacer} />

            <Paragraph style={[styles.text_price_row, { marginTop: 6 }]}>
              Остаток: {stock}
            </Paragraph>
          </View>
        )}

        {(!isOutOfStock || (isOutOfStock && !!onPress)) ? (
          <View style={styles.rowControls}>
            {/* Narrow "Add" button */}
            <View style={{ flex: 1, marginRight: 10 }}>
              <CustomButton
                title="Добавить"
                handlePress={handleAddToCart}
                containerStyles="border-4 border-red-700"
                textStyles="text-lg"
              />
            </View>

            {/* Quantity control on the right */}
            <View style={styles.qtyGroup}>
              <CustomButton
                title="-"
                handlePress={handleMinus}
                containerStyles={`w-14 h-10 border-2 rounded-full ${minusDisabled ? 'bg-gray-600 opacity-50 border-gray-500' : 'border-red-700'}`}
                textStyles="text-xl"
              />
              <Paragraph style={styles.qtyText}>
                {existing ? Number(existing.quantity) : 0}
              </Paragraph>
              <CustomButton
                title="+"
                handlePress={handlePlus}
                containerStyles={`w-14 h-10 border-2 rounded-full ${
                  plusDisabled ? 'bg-gray-600 opacity-50 border-gray-500' : 'bg-green-600 border-red-700'
                }`}
                textStyles="text-xl"
              />
            </View>
          </View>
        ) : (
          <Paragraph style={styles.out_of_stock}>Нет в наличии</Paragraph>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  text_caption: { fontWeight: 'bold', fontSize: 24, textAlign: 'center' },
  text_regular: { fontSize: 18, textAlign: 'center' },

  // Standalone price (no selection UI)
  text_price: { fontWeight: 'bold', fontSize: 18, textAlign: 'center' },

  // Inline price rows (selectable)
  text_price_row: {
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
    flexShrink: 1,
  },
  text_price_akcia: { color: '#D35400' },
  text_price_selected: { textDecorationLine: 'underline' },

  // Price line container styles
  priceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',       // gray-200
    backgroundColor: '#111827',   // subtle lift
    marginVertical: 4,
    width: '100%',
  },
  priceSpacer: { height: 12 },
  priceLineAkcia: { borderColor: '#fcd34d' }, // amber-300
  priceLineSelected: {
    borderColor: '#b91c1c',       // red-700
    backgroundColor: '#1f2937',   // slate-800-ish
  },
  priceLinePressed: { opacity: 0.9, transform: [{ scale: 0.997 }] },

  out_of_stock: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#ff4d4f', marginTop: 12 },
  rowControls: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 10,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 24,
    right: 24,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
  },
  previewCloseText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

const ZeroStockGuard = (props: ItemCardProps) => {
  const raw = (props?.stock ?? '').toString().trim();
  const normalized = raw.replace(/\s+/g, ' ').toLowerCase();
  const isZero = normalized === '0' || normalized === '0 шт' || normalized === '0pcs' || normalized === '0 pcs' || normalized === '0шт';
  if (isZero && !props?.allowZero) return null;
  return <ItemCard {...props} />;
};

export default ZeroStockGuard;
