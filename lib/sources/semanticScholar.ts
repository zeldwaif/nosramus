import type { SearchResult } from "../types";

const API = "https://api.semanticscholar.org/graph/v1";
const FIELDS =
  "paperId,title,abstract,year,venue,authors,externalIds,openAccessPdf,url";

function headers() {
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY;
  return key ? { "x-api-key": key } : undefined;
}

interface S2Paper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  venue: string | null;
  authors?: { name: string }[];
  externalIds?: { DOI?: string; ArXiv?: string; PubMed?: string };
  openAccessPdf?: { url: string } | null;
  url?: string;
}

export async function searchSemanticScholar(
  query: string,
  limit = 10
): Promise<SearchResult[]> {
  const url = `${API}/paper/search?query=${encodeURIComponent(
    query
  )}&limit=${limit}&fields=${FIELDS}`;

  const res = await fetch(url, { headers: headers() });
  if (res.status === 429) throw new Error("Semantic Scholar rate limit hit - try again shortly.");
  if (!res.ok) throw new Error(`Semantic Scholar search failed (${res.status})`);

  const json = await res.json();
  return (json.data as S2Paper[] | undefined)?.map(normalize) ?? [];
}

/** Accepts an S2 paperId, DOI, "arXiv:2301.12345", or "PMID:12345". */
export async function getSemanticScholarPaper(id: string): Promise<SearchResult | null> {
  const res = await fetch(`${API}/paper/${encodeURIComponent(id)}?fields=${FIELDS}`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  return normalize(await res.json());
}

function normalize(p: S2Paper): SearchResult {
  const arxivId = p.externalIds?.ArXiv;
  return {
    source: "semantic_scholar",
    source_id: p.paperId,
    title: p.title || "Untitled",
    authors: p.authors?.map((a) => a.name) ?? [],
    abstract: p.abstract ?? null,
    year: p.year ?? null,
    venue: p.venue || null,
    doi: p.externalIds?.DOI ?? null,
    url: p.url ?? (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : null),
    pdf_url:
      p.openAccessPdf?.url ??
      (arxivId ? `https://arxiv.org/pdf/${arxivId}` : null),
  };
}
