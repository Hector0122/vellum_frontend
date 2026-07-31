import type { Locator } from 'react-native-readium';

/**
 * Highlights, bookmarks, and book progress created before the epub.js →
 * react-native-readium migration store legacy CFI strings, not Readium
 * Locator JSON. Those fail to parse and must be treated as unusable rather
 * than crashing the reader.
 */
export function parseLocator(raw: string | null | undefined): Locator | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Locator;
  } catch {
    return null;
  }
}
