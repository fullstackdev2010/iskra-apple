// lib/toast.ts
import Toast from 'react-native-toast-message';

// Types the UI actually supports
type ToastType = 'success' | 'error' | 'info';
// Accept a broader input (so accidental "warning" won't crash)
type InputToastType = ToastType | 'warning';

const normalizeType = (t: InputToastType): ToastType => {
  // Map unsupported "warning" to "info" (or change to 'error' if you prefer)
  if (t === 'warning') return 'info';
  return t;
};

export function showTopToast(
  type: InputToastType,
  text1: string,
  text2?: string,
  visibilityTime = 3000
) {
  Toast.show({
    // ensure it's always one of the supported types
    type: normalizeType(type),
    text1,
    text2,
    position: 'top',
    topOffset: 80,
    visibilityTime,
  });
}
