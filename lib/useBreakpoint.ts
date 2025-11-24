import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'compact' | 'regular' | 'large' | 'xlarge';

export function useBreakpoint(): Breakpoint {
  const { width, height } = useWindowDimensions();
  const shortest = Math.min(width, height);
  if (shortest >= 900) return 'xlarge';
  if (shortest >= 600) return 'large';
  if (shortest >= 360) return 'regular';
  return 'compact';
}

export function useResponsiveValue<T>(
  map: Partial<Record<Breakpoint, T>>,
  fallback: T
): T {
  const bp = useBreakpoint();
  return map[bp] ?? fallback;
}
