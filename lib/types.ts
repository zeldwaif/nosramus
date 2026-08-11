export type PaperStatus = "pending" | "processing" | "ready" | "failed";
export type PaperSource = "upload" | "arxiv" | "semantic_scholar";

export interface Paper {
  id: string;
  user_id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  source: PaperSource;
  source_id: string | null;
  storage_path: string | null;
  status: PaperStatus;
  error: string | null;
  page_count: number | null;
  created_at: string;
}

export interface Chunk {
  id: string;
  paper_id: string;
  idx: number;
  content: string;
  page: number | null;
  section: string | null;
}

export interface Citation {
  n: number;
  chunk_id: string;
  paper_id: string;
  paper_title: string;
  page: number | null;
  section: string | null;
  quote: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  paper_ids: string[];
  created_at: string;
  updated_at: string;
}

/** Normalized result from an external literature search. */
export interface SearchResult {
  source: Exclude<PaperSource, "upload">;
  source_id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  pdf_url: string | null;
}
