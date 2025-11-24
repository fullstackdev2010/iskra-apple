// app/preload/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuthFlow } from '../../lib/authFlow';

const Preload = () => {
  const [started, setStarted] = useState(false);
  const { run } = useAuthFlow();

  useEffect(() => {
    if (started) return;
    setStarted(true);
    run();
  }, [started]);

  return (
    <View className="flex-1 justify-center items-center bg-primary">
      <ActivityIndicator size="large" color="#fff" />
      <Text className="text-white mt-4">Проверка авторизации...</Text>
    </View>
  );
};

export default Preload;