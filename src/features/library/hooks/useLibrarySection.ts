import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Book } from '@/types';

const KEY_SECTION = 'library_active_section';

export type LibrarySection = Book['file_type'];

export const SECTION_ORDER: LibrarySection[] = ['epub', 'pdf', 'md'];

export const SECTION_LABELS: Record<LibrarySection, string> = {
  epub: 'Books',
  pdf: 'PDFs',
  md: 'Notes',
};

export const SECTION_ICONS: Record<LibrarySection, string> = {
  epub: 'book-open-page-variant',
  pdf: 'file-pdf-box',
  md: 'note-text-outline',
};

export const SECTION_EMPTY_TEXT: Record<LibrarySection, string> = {
  epub: 'Tap + to upload an EPUB',
  pdf: 'Tap + to upload a PDF',
  md: 'Tap + to upload a Markdown note',
};

/**
 * Persists which library section (Books/PDFs/Notes) the user was last
 * viewing, so the library reopens on it — see
 * specs/document-format-sections/spec.md "Section is remembered across
 * visits".
 */
export function useLibrarySection() {
  const [section, setSectionState] = useState<LibrarySection>('epub');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(KEY_SECTION);
      if (stored && SECTION_ORDER.includes(stored as LibrarySection)) {
        setSectionState(stored as LibrarySection);
      }
      setLoaded(true);
    })();
  }, []);

  const setSection = useCallback((next: LibrarySection) => {
    setSectionState(next);
    AsyncStorage.setItem(KEY_SECTION, next).catch(() => {});
  }, []);

  return { section, setSection, loaded };
}
