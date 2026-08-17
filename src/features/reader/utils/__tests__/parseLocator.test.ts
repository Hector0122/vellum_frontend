import {
  parseLocator,
  parseEpubLocator,
  isPdfLocator,
  isMarkdownLocator,
  buildPdfLocator,
  buildMarkdownLocator,
} from '../parseLocator';

describe('parseLocator', () => {
  it('parses a valid Readium Locator JSON string', () => {
    const raw = JSON.stringify({
      href: 'chapter3.xhtml',
      type: 'application/xhtml+xml',
      locations: { progression: 0.5 },
    });

    expect(parseLocator(raw)).toEqual({
      href: 'chapter3.xhtml',
      type: 'application/xhtml+xml',
      locations: { progression: 0.5 },
    });
  });

  it('returns null for a legacy epub.js CFI string (not valid JSON)', () => {
    expect(parseLocator('epubcfi(/6/14!/4/2/2[pgepubid00001]/2/1:0)')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parseLocator(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseLocator(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseLocator('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseLocator('{href: not valid json')).toBeNull();
  });

  it('parses valid JSON that is not a Locator shape without throwing', () => {
    // parseLocator does not validate structure beyond JSON.parse succeeding —
    // this documents that behavior rather than asserting stricter validation
    // that doesn't exist.
    expect(parseLocator('{"foo":"bar"}')).toEqual({ foo: 'bar' });
  });

  it('parses a PDF locator shape', () => {
    const raw = buildPdfLocator(12, 200);
    const parsed = parseLocator(raw);
    expect(parsed).toEqual({ type: 'pdf', page: 12, totalPages: 200 });
    expect(isPdfLocator(parsed!)).toBe(true);
    expect(isMarkdownLocator(parsed!)).toBe(false);
  });

  it('parses a Markdown locator shape', () => {
    const raw = buildMarkdownLocator(3, 120);
    const parsed = parseLocator(raw);
    expect(parsed).toEqual({ type: 'md', blockIndex: 3, scrollOffset: 120 });
    expect(isMarkdownLocator(parsed!)).toBe(true);
    expect(isPdfLocator(parsed!)).toBe(false);
  });

  it('builds a Markdown locator without a scrollOffset', () => {
    const raw = buildMarkdownLocator(5);
    expect(parseLocator(raw)).toEqual({ type: 'md', blockIndex: 5, scrollOffset: undefined });
  });

  describe('parseEpubLocator', () => {
    it('returns a Readium Locator unchanged', () => {
      const raw = JSON.stringify({ href: 'ch1.xhtml', type: 'application/xhtml+xml' });
      expect(parseEpubLocator(raw)).toEqual({ href: 'ch1.xhtml', type: 'application/xhtml+xml' });
    });

    it('returns null for a PDF locator', () => {
      expect(parseEpubLocator(buildPdfLocator(1, 10))).toBeNull();
    });

    it('returns null for a Markdown locator', () => {
      expect(parseEpubLocator(buildMarkdownLocator(0))).toBeNull();
    });

    it('returns null for malformed JSON', () => {
      expect(parseEpubLocator('not json')).toBeNull();
    });

    it('returns null for null input', () => {
      expect(parseEpubLocator(null)).toBeNull();
    });
  });
});
