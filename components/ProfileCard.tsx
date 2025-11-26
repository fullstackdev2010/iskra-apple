// components/ProfileCard.tsx
import React from 'react';
import { Card, Title, Paragraph } from 'react-native-paper';
import { View, StyleSheet, Linking, Pressable } from 'react-native';
import CustomButton from '../components/CustomButton';

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
  const openEmail = () => {
    if (email2) Linking.openURL(`mailto:${email2}`);
  };

  const openPhone = () => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={{ marginTop: 8, marginBottom: 10 }}>
      <Card>
        <Card.Cover
          style={{ margin: 24 }}
          source={picture ? { uri: picture } : require('../assets/images/manager.jpg')}
          resizeMode="contain"
        />
        <Card.Content>
          <Title style={styles.text_caption}>{manager}</Title>

          <Pressable onPress={openEmail} disabled={!email2}>
            <Paragraph style={[styles.text_link, !email2 && styles.text_disabled]}>
              Эл. почта: {email2 || '—'}
            </Paragraph>
          </Pressable>

          <Pressable onPress={openPhone} disabled={!phone}>
            <Paragraph style={[styles.text_link, !phone && styles.text_disabled]}>
              Телефон: {phone || '—'}
            </Paragraph>
          </Pressable>

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
              containerStyles="mt-4 border-4 border-red-500"
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
  text_caption: {
    fontWeight: 'bold',
    fontSize: 24,
    textAlign: 'center',
  },
  text_link: {
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
    color: '#709bf2',
    textDecorationLine: 'underline',
    marginVertical: 6,
  },
  text_disabled: {
    color: '#888',
    textDecorationLine: 'none',
  },
});

export default ProfileCard;