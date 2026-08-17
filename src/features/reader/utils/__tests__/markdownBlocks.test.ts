import { splitMarkdownBlocks } from '../markdownBlocks';

describe('splitMarkdownBlocks', () => {
  it('splits headings and paragraphs into separate blocks', () => {
    const md = '# Title\n\nIntro paragraph.\n\n## Section A\n\nBody A.\n\n## Section B\n\nBody B, more text.\n';
    const blocks = splitMarkdownBlocks(md);
    expect(blocks.map((b) => b.text)).toEqual([
      '# Title',
      'Intro paragraph.',
      '## Section A',
      'Body A.',
      '## Section B',
      'Body B, more text.',
    ]);
  });

  it('numbers sections starting at 0 for a document beginning with a heading (no intro section)', () => {
    const md = '# Title\n\nIntro paragraph.\n\n## Section A\n\nBody A.\n\n## Section B\n\nBody B.\n';
    const blocks = splitMarkdownBlocks(md);
    // Matches vellum_backend/src/lib/markdown.ts sectionize(): the doc opens
    // directly with a heading, so that heading IS section 0, not an intro.
    expect(blocks.map((b) => b.sectionIndex)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('gives intro text before the first heading its own section 0, offsetting subsequent sections', () => {
    const md = 'Some intro text with no heading above it.\n\n## Section A\n\nBody A.\n';
    const blocks = splitMarkdownBlocks(md);
    expect(blocks.map((b) => b.sectionIndex)).toEqual([0, 1, 1]);
  });

  it('does not split inside a fenced code block even across blank lines', () => {
    const md = '# Title\n\n```\nline one\n\nline two\n```\n\nAfter code.\n';
    const blocks = splitMarkdownBlocks(md);
    expect(blocks.map((b) => b.text)).toEqual([
      '# Title',
      '```\nline one\n\nline two\n```',
      'After code.',
    ]);
  });

  it('treats a heading as always its own solo block even without a following blank line', () => {
    const md = '## Section A\nBody right after, no blank line.\n';
    const blocks = splitMarkdownBlocks(md);
    expect(blocks.map((b) => b.text)).toEqual([
      '## Section A',
      'Body right after, no blank line.',
    ]);
  });

  it('handles a document with no headings at all as one growing section 0', () => {
    const md = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.\n';
    const blocks = splitMarkdownBlocks(md);
    expect(blocks.every((b) => b.sectionIndex === 0)).toBe(true);
    expect(blocks.every((b) => !b.isHeading)).toBe(true);
  });

  it('returns an empty array for empty input', () => {
    expect(splitMarkdownBlocks('')).toEqual([]);
  });
});
