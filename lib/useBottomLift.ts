// lib/useBottomLift.ts
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Stable bottom padding for screens with a bottom tab bar.
 * Do NOT change padding based on keyboard visibility; let a KeyboardAvoidingView
 * (or your screen) handle it. This prevents the Android focus/blur loop.
 */
export function useBottomLiftTabs(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 8);
}

/** Back-compat aliases (some screens may import these names) */
export const useBottomLiftStandalone = useBottomLiftTabs;
export const useBottomLift = useBottomLiftTabs;

/** Default export for older default-import code */
export default useBottomLiftTabs;
