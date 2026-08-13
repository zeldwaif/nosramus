export interface Contradiction {
  claim: string;
  paper_a: string;
  quote_a: string;
  paper_b: string;
  quote_b: string;
}

const BLOCK_RE = /<contradictions>([\s\S]*?)<\/contradictions>\s*$/;

/** Parse and strip the contradictions block appended by the model. */
export function parseContradictions(text: string): {
  content: string;
  contradictions: Contradiction[];
} {
  const match = text.match(BLOCK_RE);
  if (!match) return { content: text, contradictions: [] };

  const content = text.slice(0, match.index).trimEnd();
  try {
    const parsed = JSON.parse(match[1].trim()) as Contradiction[];
    const contradictions = Array.isArray(parsed) ? parsed : [];
    return { content, contradictions };
  } catch {
    return { content, contradictions: [] };
  }
}
