import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';

const CACHE_KEY = 'reading_stats';

interface StreakData {
  currentStreak: number;
  todayMinutes: number;
  totalMinutes: number;
}

export function useReadingStats() {
  const [streak, setStreak] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const prevStreakRef = useRef(0);
  const streakChangedRef = useRef(false);

  const fetchStreak = useCallback(async () => {
    try {
      const data = await api.get<StreakData>('/api/stats/streak');
      setStreak(data.currentStreak);
      setTodayMinutes(data.todayMinutes);
      setTotalMinutes(data.totalMinutes);

      streakChangedRef.current = data.currentStreak > prevStreakRef.current;
      prevStreakRef.current = data.currentStreak;

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as StreakData;
        setStreak(data.currentStreak);
        setTodayMinutes(data.todayMinutes);
        setTotalMinutes(data.totalMinutes);
      }
    }
  }, []);

  const loadCached = useCallback(async () => {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached) as StreakData;
      setStreak(data.currentStreak);
      setTodayMinutes(data.todayMinutes);
      setTotalMinutes(data.totalMinutes);
      prevStreakRef.current = data.currentStreak;
    }
  }, []);

  useEffect(() => {
    loadCached();
  }, [loadCached]);

  const startSession = useCallback(async (bookId: string) => {
    try {
      const { session } = await api.post<{ session: { id: string } }>(
        '/api/stats/session',
        { bookId },
      );
      return session.id;
    } catch {
      return null;
    }
  }, []);

  const endSession = useCallback(
    async (sessionId: string | null, wordsRead: number = 0) => {
      if (!sessionId) return;
      try {
        await api.patch(`/api/stats/session/${sessionId}`, {
          wordsRead,
        });
        await fetchStreak();
      } catch {}
    },
    [fetchStreak],
  );

  return {
    streak,
    todayMinutes,
    totalMinutes,
    streakChanged: streakChangedRef.current,
    fetchStreak,
    startSession,
    endSession,
  };
}
