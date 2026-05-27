import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SIZE = 'reader_font_size';
const KEY_FAMILY = 'reader_font_family';

const FONT_OPTIONS = [
  { key: 'system-ui', label: 'System' },
  { key: 'Georgia, serif', label: 'Serif' },
  { key: 'Helvetica, Arial, sans-serif', label: 'Sans' },
  { key: 'monospace', label: 'Mono' },
];

const SIZE_STEPS = [0.7, 0.85, 1, 1.2, 1.5, 2];

export function useFontPrefs() {
  const [fontSize, setFontSize] = useState(1);
  const [fontFamily, setFontFamily] = useState('system-ui');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const size = await AsyncStorage.getItem(KEY_SIZE);
      const family = await AsyncStorage.getItem(KEY_FAMILY);
      if (size) setFontSize(parseFloat(size));
      if (family) setFontFamily(family);
      setLoaded(true);
    })();
  }, []);

  const increaseSize = useCallback(async () => {
    const idx = SIZE_STEPS.indexOf(fontSize);
    if (idx < SIZE_STEPS.length - 1) {
      const next = SIZE_STEPS[idx + 1];
      setFontSize(next);
      await AsyncStorage.setItem(KEY_SIZE, String(next));
    }
  }, [fontSize]);

  const decreaseSize = useCallback(async () => {
    const idx = SIZE_STEPS.indexOf(fontSize);
    if (idx > 0) {
      const prev = SIZE_STEPS[idx - 1];
      setFontSize(prev);
      await AsyncStorage.setItem(KEY_SIZE, String(prev));
    }
  }, [fontSize]);

  const cycleFont = useCallback(async () => {
    const currentIdx = FONT_OPTIONS.findIndex((f) => f.key === fontFamily);
    const nextIdx = (currentIdx + 1) % FONT_OPTIONS.length;
    const next = FONT_OPTIONS[nextIdx].key;
    setFontFamily(next);
    await AsyncStorage.setItem(KEY_FAMILY, next);
  }, [fontFamily]);

  return {
    fontSize,
    fontFamily,
    loaded,
    increaseSize,
    decreaseSize,
    cycleFont,
    fontLabel: FONT_OPTIONS.find((f) => f.key === fontFamily)?.label || 'System',
  };
}
