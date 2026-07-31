import { parseLocator } from '../parseLocator';

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
});
