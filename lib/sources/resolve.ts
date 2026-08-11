import type { SearchResult } from "../types";
import { getArxivPaper, normalizeArxivId } from "./arxiv";
import { getSemanticScholarPaper } from "./semanticScholar";

const ARXIV_RE = /(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:)?(\d{4}\.\d{4,5})(?:v\d+)?/i;
const DOI_RE = /(10\.\d{4,9}\/[-._;()/:a-z0-9]+)/i;

/**
 * Turns whatever the user pasted - arXiv id or link, DOI, doi.org URL, or an
 * S2 paperId - into a normalized paper record.
 */
export async function resolveIdentifier(input: string): Promise<SearchResult | null> {
  const raw = input.trim();

  const arxiv = raw.match(ARXIV_RE);
  if (arxiv) {
    const found = await getArxivPaper(normalizeArxivId(arxiv[1]));
    if (found) return found;
  }

  const doi = raw.match(DOI_RE);
  if (doi) {
    const found = await getSemanticScholarPaper(`DOI:${doi[1]}`);
    if (found) return found;
  }

  if (/^[0-9a-f]{40}$/i.test(raw)) return getSemanticScholarPaper(raw);

  return null;
}
