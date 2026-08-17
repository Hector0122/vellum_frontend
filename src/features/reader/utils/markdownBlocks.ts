const HEADING_RE = /^#{1,6}\s/;
const FENCE_RE = /^```/;

export interface MarkdownBlock {
  text: string;
  isHeading: boolean;
  /**
   * Index of the heading-delimited section this block belongs to — mirrors
   * vellum_backend's src/lib/markdown.ts `sectionize()` numbering exactly
   * (intro text before the first heading, if any, is section 0 and pushes
   * the first heading to section 1; a document starting directly with a
   * heading makes that heading section 0), so `fetchSummary` can send the
   * same section index the backend's AI-summary extraction expects. Kept
   * intentionally independent implementations rather than sharing code
   * across the frontend/backend boundary — see markdownBlocks.test.ts for
   * the cases that pin this numbering down.
   */
  sectionIndex: number;
}

/** Splits markdown source into flat paragraph/heading blocks, respecting
 * fenced code blocks (no splitting inside ``` fences). Headings are always
 * their own solo block. Used for progress tracking and block-level
 * highlighting — see design.md "Revised during implementation" note on why
 * highlighting is block-level rather than text-range for Markdown. */
function splitParagraphs(source: string): string[] {
  const lines = source.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  const flush = () => {
    const text = current.join('\n').trim();
    if (text) blocks.push(text);
    current = [];
  };

  for (const rawLine of lines) {
    const isFenceMarker = FENCE_RE.test(rawLine.trim());
    const isHeadingLine = !inFence && HEADING_RE.test(rawLine);

    if (isHeadingLine) {
      flush();
      current.push(rawLine);
      flush();
      continue;
    }

    if (!inFence && rawLine.trim() === '') {
      flush();
      continue;
    }

    current.push(rawLine);
    if (isFenceMarker) inFence = !inFence;
  }
  flush();

  return blocks;
}

export function splitMarkdownBlocks(source: string): MarkdownBlock[] {
  const paragraphs = splitParagraphs(source);
  const blocks: MarkdownBlock[] = [];

  let sectionIndex = -1;
  let hasContentInCurrentSection = false;

  for (const text of paragraphs) {
    const isHeading = HEADING_RE.test(text);

    if (isHeading) {
      if (sectionIndex === -1 && !hasContentInCurrentSection) {
        sectionIndex = 0;
      } else {
        sectionIndex += 1;
      }
      hasContentInCurrentSection = false;
    } else if (sectionIndex === -1) {
      sectionIndex = 0;
    }

    blocks.push({ text, isHeading, sectionIndex });
    hasContentInCurrentSection = true;
  }

  return blocks;
}
