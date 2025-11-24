// app/store/details.tsx
import React, { useLayoutEffect, useEffect, useState } from "react";
import { View, Text, Image, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { images } from "../../constants";
import { getOrderById, Order } from "../../lib/orders";
import { useBottomLiftStandalone } from "../../lib/useBottomLift";

type OrderLine = {
  code: string;
  article: string;
  description: string;
  quantity: number;

  // legacy orders:
  price?: number;

  // snapshot fields (preferred):
  unit_final_price?: number;
  line_total?: number;
};

const Details = () => {
  const navigation = useNavigation();
  const { orderId, orderNo } =
    useLocalSearchParams<{ orderId: string; orderNo: string }>();
  const [order, setOrder] = useState<Order | null>(null);

  // Bottom padding so final rows are fully visible (no tab bar on this route)
  const bottomPad = useBottomLiftStandalone();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (!orderId) return;
    getOrderById(Number(orderId))
      .then(setOrder)
      .catch(console.error);
  }, [orderId]);

  if (!order) return null;

  let lines: OrderLine[] = [];
  try {
    lines = JSON.parse(order.items_json || "[]");
  } catch (err) {
    console.error("Failed to parse order items:", err);
  }

  const unit = (l: OrderLine) =>
    typeof l.unit_final_price === "number" ? l.unit_final_price : (l.price ?? 0);

  const total = (l: OrderLine) =>
    typeof l.line_total === "number" ? l.line_total : unit(l) * (l.quantity ?? 0);

  const Header = () => (
    <View className="bg-primary px-4 pt-2 pb-3">
      <View className="m-0 flex-row items-center justify-center">
        <Text className="text-2xl font-psemibold text-white" numberOfLines={1} ellipsizeMode="clip">
          Заказ No. {orderNo}
        </Text>
        <Image source={images.logoSmall} className="w-9 h-10 ml-3" resizeMode="contain" />
      </View>
    </View>
  );

  return (
    <SafeAreaView className="bg-primary flex-1">
      {/* Fixed top header */}
      <Header />

      <ScrollView
        className="px-4"
        contentContainerStyle={{ paddingTop: 4, paddingBottom: bottomPad }}
      >
        {lines.map((line, idx) => {
          const u = unit(line);
          const t = total(line);
          const query = (line.article || line.code || "").trim();

          return (
            <Pressable
              key={`${line.code || "line"}-${idx}`}
              className="mb-6"
              onPress={() => {
                if (query) {
                  // Allow showing zero-stock in Search when coming from Orders
                  router.push(
                    `/search/${encodeURIComponent(query)}?source=orders&showUnavailable=1`
                  );
                }
              }}
            >
              <Text className="text-md font-psemibold text-white mb-1">
                {idx + 1}. {line.article} — {line.description}
              </Text>
              <Text className="text-white text-base">
                Цена: {u}₽ × {line.quantity} шт = {t}₽
              </Text>
              <View className="border-b border-gray-300 mt-4" />
            </Pressable>
          );
        })}

        <Text className="text-xl font-psemibold text-white text-center mt-4">
          Общая сумма: {order.sum}₽
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Details;
