export interface PageText {
  page: number;
  text: string;
}

export interface TextChunk {
  idx: number;
  content: string;
  page: number | null;
  section: string | null;
  token_count: number;
}

/** ~4 chars per token is close enough for budgeting. */
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

const SECTION_RE =
  /^\s*(?:\d+(?:\.\d+)*\.?\s+)?(abstract|introduction|background|related work|methods?|methodology|materials and methods|experiments?|results?|discussion|conclusions?|limitations|future work|acknowledg(?:e)?ments|references|appendix|supplementary)\b.*$/i;

function detectSection(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return null;
  const m = trimmed.match(SECTION_RE);
  return m ? m[1].replace(/\s+/g, " ").toLowerCase() : null;
}

/**
 * Paragraph-aware chunker. Keeps paragraphs intact where possible, tracks the
 * page and the most recent section heading, and overlaps chunks so a fact that
 * straddles a boundary is still retrievable.
 */
export function chunkPages(
  pages: PageText[],
  { targetTokens = 500, overlapTokens = 80 } = {}
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let buf: string[] = [];
  let bufTokens = 0;
  let bufPage: number | null = null;
  let section: string | null = null;
  let idx = 0;

  const flush = () => {
    const content = buf.join("\n\n").trim();
    if (content.length > 40) {
      chunks.push({
        idx: idx++,
        content,
        page: bufPage,
        section,
        token_count: estimateTokens(content),
      });
    }
    // Carry the tail of this chunk into the next one for context overlap.
    const tail: string[] = [];
    let tailTokens = 0;
    for (let i = buf.length - 1; i >= 0 && tailTokens < overlapTokens; i--) {
      tail.unshift(buf[i]);
      tailTokens += estimateTokens(buf[i]);
    }
    buf = tail;
    bufTokens = tailTokens;
  };

  for (const { page, text } of pages) {
    const paragraphs = text
      .replace(/\r/g, "")
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);

    for (const para of paragraphs) {
      const heading = detectSection(para);
      if (heading) {
        if (bufTokens > 0) flush();
        section = heading;
      }

      const tokens = estimateTokens(para);

      // A single oversized paragraph gets split on sentence boundaries.
      if (tokens > targetTokens * 1.5) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        for (const s of sentences) {
          if (bufTokens + estimateTokens(s) > targetTokens && bufTokens > 0) flush();
          if (bufPage === null || bufTokens === 0) bufPage = page;
          buf.push(s);
          bufTokens += estimateTokens(s);
        }
        continue;
      }

      if (bufTokens + tokens > targetTokens && bufTokens > 0) flush();
      if (bufPage === null || bufTokens === 0) bufPage = page;
      buf.push(para);
      bufTokens += tokens;
    }
  }

  if (bufTokens > 0) {
    const content = buf.join("\n\n").trim();
    if (content.length > 40) {
      chunks.push({
        idx: idx++,
        content,
        page: bufPage,
        section,
        token_count: estimateTokens(content),
      });
    }
  }

  return chunks;
}
