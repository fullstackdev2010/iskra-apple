// components/ErrorFallback.tsx
import React from 'react';
import { View, Text, Button } from 'react-native';

type ErrorFallbackProps = {
  error: { message?: string } | null;
  resetError: () => void;
};

const ErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({ error, resetError }) => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
      <Text style={{ color: 'red', fontSize: 18, marginBottom: 12 }}>
        Что-то пошло не так.
      </Text>
      <Text selectable style={{ color: '#aaa', marginBottom: 12 }}>
        {error?.message}
      </Text>
      <Button title="Попробовать снова" onPress={resetError} />
    </View>
  );
};

export default ErrorFallback;
