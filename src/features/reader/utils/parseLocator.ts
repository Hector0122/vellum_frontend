import type { Locator } from 'react-native-readium';

/**
 * Locator shape for a PDF position — page-based (see design.md Decision 3 in
 * openspec/changes/add-multi-format-documents), since standard PDF rendering
 * doesn't expose the text-offset/CFI-equivalent addressing Readium uses for
 * EPUB.
 */
export interface PdfLocatorData {
  type: 'pdf';
  page: number;
  totalPages: number;
}

/**
 * Locator shape for a Markdown position — the index of the rendered block
 * (heading/paragraph/etc.) nearest the top of the viewport, which stays
 * stable across re-renders and font-size changes unlike a raw scroll offset
 * alone. `scrollOffset` is an optional finer-grained hint within that block.
 */
export interface MarkdownLocatorData {
  type: 'md';
  blockIndex: number;
  scrollOffset?: number;
}

export type ParsedLocator = Locator | PdfLocatorData | MarkdownLocatorData;

export function isPdfLocator(locator: ParsedLocator): locator is PdfLocatorData {
  return (locator as PdfLocatorData).type === 'pdf';
}

export function isMarkdownLocator(locator: ParsedLocator): locator is MarkdownLocatorData {
  return (locator as MarkdownLocatorData).type === 'md';
}

/**
 * Highlights, bookmarks, and book progress created before the epub.js →
 * react-native-readium migration store legacy CFI strings, not Readium
 * Locator JSON. Those fail to parse and must be treated as unusable rather
 * than crashing the reader.
 *
 * Since the multi-format-documents change, this also parses PDF and
 * Markdown locator shapes (see PdfLocatorData / MarkdownLocatorData above).
 * All three shapes round-trip through the same opaque TEXT column
 * (`progress_locator` / `locator`), tagged by a `type` field that a Readium
 * `Locator` never sets to `'pdf'` or `'md'` (Readium's own `type` field
 * always holds a MIME type, e.g. `"application/xhtml+xml"`), so the two
 * never collide.
 */
export function parseLocator(raw: string | null | undefined): ParsedLocator | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ParsedLocator;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Narrows parseLocator()'s result to a Readium Locator, for call sites that
 * only ever deal with EPUB (e.g. handing a value straight to ReadiumView's
 * API, which is EPUB-only — see react-native-readium's format support
 * table). Returns null for a PDF/Markdown locator or unparseable input
 * alike, since neither is usable as a Readium Locator.
 */
export function parseEpubLocator(raw: string | null | undefined): Locator | null {
  const parsed = parseLocator(raw);
  if (!parsed) return null;
  if (isPdfLocator(parsed) || isMarkdownLocator(parsed)) return null;
  return parsed;
}

export function buildPdfLocator(page: number, totalPages: number): string {
  const data: PdfLocatorData = { type: 'pdf', page, totalPages };
  return JSON.stringify(data);
}

export function buildMarkdownLocator(blockIndex: number, scrollOffset?: number): string {
  const data: MarkdownLocatorData = { type: 'md', blockIndex, scrollOffset };
  return JSON.stringify(data);
}
