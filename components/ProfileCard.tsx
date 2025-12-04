// components/ProfileCard.tsx
import React, { useEffect, useState } from "react";
import { Card, Title, Paragraph } from "react-native-paper";
import { View, StyleSheet, Linking, Pressable, Switch, Text } from "react-native";
import CustomButton from "../components/CustomButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGlobalContext } from "../context/GlobalProvider";

const DEFAULT_BIOMETRIC = true;

interface ItemCardProps {
  manager: string;
  email2?: string;
  phone?: string;
  picture?: string;
  handlePress: () => void;
  onResetPin?: () => void;
  onDeleteAccount?: () => void;
}

const ProfileCard: React.FC<ItemCardProps> = ({
  manager,
  email2,
  phone,
  picture,
  handlePress,
  onResetPin,
  onDeleteAccount,
}) => {
  const openEmail = () => email2 && Linking.openURL(`mailto:${email2}`);
  const openPhone = () => phone && Linking.openURL(`tel:${phone}`);

  const { guestModeDefault, setGuestModeDefault } = useGlobalContext();

  const [biometricEnabled, setBiometricEnabled] = useState(DEFAULT_BIOMETRIC);
  const [guestEnabled, setGuestEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const bio = await AsyncStorage.getItem("biometric_enabled");
      const guest = await AsyncStorage.getItem("guest_default");

      if (bio === "0") setBiometricEnabled(false);
      if (bio === "1") setBiometricEnabled(true);

      if (guest === "0") setGuestEnabled(false);
      if (guest === "1") setGuestEnabled(true);
    })();
  }, []);

  const saveBio = async (v: boolean) => {
    setBiometricEnabled(v);
    await AsyncStorage.setItem("biometric_enabled", v ? "1" : "0");
  };

  const saveGuest = async (v: boolean) => {
    setGuestEnabled(v);
    setGuestModeDefault(v); // update global context
    await AsyncStorage.setItem("guest_default", v ? "1" : "0");
  };

  return (
    <View style={{ marginTop: 8, marginBottom: 10 }}>
      <Card>
        <Card.Cover
          style={{ margin: 24 }}
          source={picture ? { uri: picture } : require("../assets/images/manager.jpg")}
          resizeMode="contain"
        />
        <Card.Content>
          <Title style={styles.text_caption}>{manager}</Title>

          <Pressable onPress={openEmail} disabled={!email2}>
            <Paragraph style={[styles.text_link, !email2 && styles.text_disabled]}>
              Эл. почта: {email2 || "—"}
            </Paragraph>
          </Pressable>

          <Pressable onPress={openPhone} disabled={!phone}>
            <Paragraph style={[styles.text_link, !phone && styles.text_disabled]}>
              Телефон: {phone || "—"}
            </Paragraph>
          </Pressable>

          
          {/* SETTINGS BLOCK */}
          <View
            style={{
              marginTop: 20,
              borderWidth: 5,
              borderColor: "#ff0000",
              borderRadius: 16,
              overflow: "hidden", // ⭐ KEY: Prevent background from overflowing borders
            }}
          >
            <View
              style={{
                backgroundColor: "#FF9C01",
                borderRadius: 8, // slightly smaller radius so corners render cleanly
                paddingVertical: 12,
                paddingHorizontal: 18,
              }}
            >
              {/* Biometric */}
              <View style={styles.row}>
                <Text style={styles.label}>Использовать биометрию для входа</Text>

                <Switch
                  trackColor={{ false: "#374151", true: "#709bf2" }}
                  thumbColor="#f9fafb"
                  value={biometricEnabled}
                  onValueChange={saveBio}
                  style={styles.switch}
                />
              </View>

              {/* Guest mode */}
              <View style={styles.row}>
                <Text style={styles.label}>Включить гостевой режим по умолчанию</Text>

                <Switch
                  trackColor={{ false: "#374151", true: "#709bf2" }}
                  thumbColor="#f9fafb"
                  value={guestEnabled}
                  onValueChange={saveGuest}
                  style={styles.switch}
                />
              </View>
            </View>
          </View>

          <CustomButton
            title="Выход из учетной записи"
            handlePress={handlePress}
            containerStyles="mt-8 border-4 border-red-700"
            textStyles="text-xl"
          />

          {onResetPin && (
            <CustomButton
              title="Сброс PIN"
              handlePress={onResetPin}
              containerStyles="mt-4 border-4 border-red-700"
              textStyles="text-xl"
            />
          )}

          {onDeleteAccount && (
            <CustomButton
              title="Удалить аккаунт из приложения"
              handlePress={onDeleteAccount}
              containerStyles="mt-4 border-4 border-red-700"
              textStyles="text-xl"
            />
          )}
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 10,
  },
  switch: {
    transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }],
  },
  label: {
    color: "#161622",
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    paddingRight: 10,
  },
  text_caption: {
    fontWeight: "bold",
    fontSize: 24,
    textAlign: "center",
  },
  text_link: {
    fontWeight: "bold",
    fontSize: 18,
    textAlign: "center",
    color: "#709bf2",
    textDecorationLine: "underline",
    marginVertical: 6,
  },
  text_disabled: {
    color: "#888",
    textDecorationLine: "none",
  },
});

export default ProfileCard;
