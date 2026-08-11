import { extractText, getDocumentProxy } from "unpdf";
import type { PageText } from "./chunking";

export interface ExtractedPdf {
  pages: PageText[];
  pageCount: number;
  /** First non-trivial line of page 1 - a decent title guess for bare uploads. */
  guessedTitle: string | null;
}

export async function extractPdf(data: ArrayBuffer): Promise<ExtractedPdf> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text, totalPages } = await extractText(pdf, { mergePages: false });

  const pages: PageText[] = (text as string[]).map((t, i) => ({
    page: i + 1,
    text: t || "",
  }));

  const nonEmpty = pages.filter((p) => p.text.trim().length > 0);
  if (nonEmpty.length === 0) {
    throw new Error(
      "No text found in this PDF. It is probably a scan - run it through OCR first."
    );
  }

  return { pages, pageCount: totalPages, guessedTitle: guessTitle(pages[0]?.text) };
}

function guessTitle(firstPage?: string): string | null {
  if (!firstPage) return null;
  const line = firstPage
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 15 && l.length < 250 && /[a-z]/.test(l));
  return line ?? null;
}
