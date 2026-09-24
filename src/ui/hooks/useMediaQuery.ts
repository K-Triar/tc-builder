import { useSyncExternalStore } from 'react';

/** メディアクエリに合っているか（matchMedia が無い環境では false） */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = globalThis.matchMedia?.(query);
      mql?.addEventListener('change', onChange);
      return () => mql?.removeEventListener('change', onChange);
    },
    () => globalThis.matchMedia?.(query).matches ?? false,
    () => false,
  );
}
