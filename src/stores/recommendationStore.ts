import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '@/shared/lib/api';
import type { BookSuggestion } from '@/types';

interface SuggestionsResponse {
  suggestions: BookSuggestion[];
}

interface RecommendationState {
  suggestions: BookSuggestion[];
  wishlist: BookSuggestion[];
  loading: boolean;
  generating: boolean;
  fetchSuggestions: () => Promise<void>;
  generateSuggestions: () => Promise<void>;
  markAsWantToRead: (id: string) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  fetchWishlist: () => Promise<void>;
}

export const useRecommendationStore = create<RecommendationState>()(
  persist(
    (set, get) => ({
      suggestions: [],
      wishlist: [],
      loading: false,
      generating: false,

      fetchSuggestions: async () => {
        set({ loading: true });
        try {
          const data = await api.get<SuggestionsResponse>('/api/recommendations');
          set({ suggestions: data.suggestions, loading: false });
        } catch {
          set({ loading: false });
        }
      },

      generateSuggestions: async () => {
        set({ generating: true });
        try {
          const data = await api.post<SuggestionsResponse>('/api/recommendations/generate');
          set({ suggestions: data.suggestions, generating: false });
        } catch {
          set({ generating: false });
        }
      },

      markAsWantToRead: async (id: string) => {
        try {
          await api.patch(`/api/recommendations/${id}`, { status: 'want_to_read' });
          const { suggestions, wishlist } = get();
          const suggestion = suggestions.find((s) => s.id === id);
          if (suggestion) {
            set({
              suggestions: suggestions.filter((s) => s.id !== id),
              wishlist: [...wishlist, { ...suggestion, status: 'want_to_read' }],
            });
          }
        } catch {
          // silent fail
        }
      },

      dismissSuggestion: async (id: string) => {
        try {
          await api.patch(`/api/recommendations/${id}`, { status: 'dismissed' });
          const { suggestions } = get();
          set({ suggestions: suggestions.filter((s) => s.id !== id) });
        } catch {
          // silent fail
        }
      },

      fetchWishlist: async () => {
        set({ loading: true });
        try {
          const data = await api.get<SuggestionsResponse>('/api/recommendations/wishlist');
          set({ wishlist: data.suggestions, loading: false });
        } catch {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'vellum-recommendations',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
