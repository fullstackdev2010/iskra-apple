// components/OfflineBanner.tsx
import React from 'react';
import { View, Text, Platform } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';

const OfflineBanner: React.FC = () => {
  const { isConnected } = useNetInfo();

  // If unknown (null) or online → render nothing
  if (isConnected == null || isConnected) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: Platform.OS === 'ios' ? 44 : 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#FF9C01', // same palette as your tab badge
        paddingVertical: 6,
        paddingHorizontal: 10,
        alignItems: 'center',
      }}>
      <Text style={{ color: '#161622', fontWeight: '700' }}>
        Нет интернета — оффлайн
      </Text>
    </View>
  );
};

export default OfflineBanner;
