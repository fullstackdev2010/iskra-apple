// lib/responsive.ts
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

export type SizeClass = 'smallPhone' | 'phone' | 'tallPhone' | 'tablet';

export function useSizeClass(): SizeClass {
  const { width, height } = useWindowDimensions();
  const minDim = Math.min(width, height);

  if (minDim >= 600) return 'tablet';
  if (height >= 900) return 'tallPhone';
  if (height < 680) return 'smallPhone';
  return 'phone';
}

export function useStableTabBarHeight() {
  const size = useSizeClass();
  const provided = useBottomTabBarHeight?.() || 0;

  const baseline =
    size === 'smallPhone' ? 56 :
    size === 'phone'      ? 60 :
    size === 'tallPhone'  ? 64 :
                            72; // tablet

  return provided > 0 ? provided : baseline;
}

export function useContentBottomPad(extra: number = 6) {
  const insets = useSafeAreaInsets();
  const tabH = useStableTabBarHeight();

  return useMemo(() => {
    const pad = Math.round(tabH * 0.9) + Math.max(extra, insets.bottom);
    return pad;
  }, [insets.bottom, tabH, extra]);
}

export function useUIVars() {
  const cls = useSizeClass();

  const qtyButtonWH =
    cls === 'tablet' ? 56 :
    cls === 'tallPhone' ? 52 :
    48;

  const thumbSize =
    cls === 'tablet' ? 112 :
    cls === 'tallPhone' ? 96 :
    88;

  return { cls, qtyButtonWH, thumbSize };
}
