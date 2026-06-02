import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'reader_warm_paper';

export function useWarmPaper() {
  const [warmPaper, setWarmPaper] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const val = await AsyncStorage.getItem(KEY);
      if (val === 'true') setWarmPaper(true);
      setLoaded(true);
    })();
  }, []);

  const toggle = useCallback(async () => {
    const next = !warmPaper;
    setWarmPaper(next);
    await AsyncStorage.setItem(KEY, String(next));
  }, [warmPaper]);

  return { warmPaper, loaded, toggle };
}
