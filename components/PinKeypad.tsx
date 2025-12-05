// components/PinKeypad.tsx
import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

type PinKeypadProps = {
  onPress: (d: string) => void;
  onDelete: () => void;
  disabled?: boolean;
};

const PinKeypad = ({ onPress, onDelete, disabled }: PinKeypadProps) => {
  const keys = [['1','2','3'], ['4','5','6'], ['7','8','9'], ['','0','←']];

  const handleKeyPress = (key: string) => {
    if (key === '←') {
      onDelete();
    } else if (key) {
      onPress(key);
    }

    if (Platform.OS === 'android') {
      Haptics.selectionAsync();
    }
  };

  return (
    <View className="w-full">
      {keys.map((row, i) => (
        <View key={i} className="flex-row justify-around my-2">
          {row.map((key, j) => (
            <Pressable
              key={j}
              onPress={() => handleKeyPress(key)}
              className="w-16 h-16 rounded-full justify-center items-center bg-gray-700"
            >
              <Text className="text-2xl font-bold color-secondary-300">{key}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
};

export default PinKeypad;