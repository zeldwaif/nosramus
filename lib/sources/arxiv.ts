import { XMLParser } from "fast-xml-parser";
import type { SearchResult } from "../types";

const API = "http://export.arxiv.org/api/query";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });

const asArray = <T,>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

/** Strips the trailing version suffix: "2301.12345v3" -> "2301.12345". */
export const normalizeArxivId = (id: string) =>
  id.replace(/^.*abs\//, "").replace(/v\d+$/, "").trim();

export async function searchArxiv(query: string, limit = 10): Promise<SearchResult[]> {
  const url = `${API}?search_query=${encodeURIComponent(
    `all:${query}`
  )}&start=0&max_results=${limit}&sortBy=relevance`;

  const res = await fetch(url, { headers: { "user-agent": "nosramus/0.1" } });
  if (!res.ok) throw new Error(`arXiv search failed (${res.status})`);

  return parseFeed(await res.text());
}

export async function getArxivPaper(id: string): Promise<SearchResult | null> {
  const url = `${API}?id_list=${encodeURIComponent(normalizeArxivId(id))}&max_results=1`;
  const res = await fetch(url, { headers: { "user-agent": "nosramus/0.1" } });
  if (!res.ok) return null;
  return parseFeed(await res.text())[0] ?? null;
}

function parseFeed(xml: string): SearchResult[] {
  const feed = parser.parse(xml)?.feed;
  return asArray<Record<string, unknown>>(feed?.entry as never).map((e) => {
    const rawId = String(e.id ?? "");
    const id = normalizeArxivId(rawId);
    const links = asArray<Record<string, string>>(e.link as never);
    const pdf =
      links.find((l) => l["@title"] === "pdf")?.["@href"] ??
      `https://arxiv.org/pdf/${id}`;

    return {
      source: "arxiv" as const,
      source_id: id,
      title: clean(String(e.title ?? "Untitled")),
      authors: asArray<{ name: string }>(e.author as never).map((a) => a.name),
      abstract: e.summary ? clean(String(e.summary)) : null,
      year: e.published ? new Date(String(e.published)).getUTCFullYear() : null,
      venue: e["arxiv:journal_ref"] ? String(e["arxiv:journal_ref"]) : "arXiv",
      doi: e["arxiv:doi"] ? String(e["arxiv:doi"]) : null,
      url: `https://arxiv.org/abs/${id}`,
      pdf_url: pdf,
    };
  });
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
