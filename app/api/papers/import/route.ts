import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { fetchPdf, ingestPdf } from "@/lib/ingest";
import { resolveIdentifier } from "@/lib/sources/resolve";
import { fail } from "@/lib/http";
import type { SearchResult } from "@/lib/types";

export const maxDuration = 300;

/**
 * Import a paper found via search. Accepts either a full SearchResult (from the
 * search endpoint) or a bare `identifier` string to resolve first.
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = (await request.json()) as {
      result?: SearchResult;
      identifier?: string;
    };

    let result = body.result;
    if (!result && body.identifier) {
      result = (await resolveIdentifier(body.identifier)) ?? undefined;
    }
    if (!result) {
      return NextResponse.json(
        { error: "Could not identify that paper." },
        { status: 400 }
      );
    }

    // Already in the library? Return it instead of duplicating.
    const { data: existing } = await supabase
      .from("papers")
      .select("*")
      .eq("user_id", user.id)
      .eq("source", result.source)
      .eq("source_id", result.source_id)
      .maybeSingle();
    if (existing) return NextResponse.json({ paper: existing, already: true });

    if (!result.pdf_url) {
      return NextResponse.json(
        {
          error:
            "No open-access PDF is available for this paper. Download it manually and upload the file.",
        },
        { status: 422 }
      );
    }

    const { data: paper, error } = await supabase
      .from("papers")
      .insert({
        user_id: user.id,
        title: result.title,
        authors: result.authors,
        abstract: result.abstract,
        year: result.year,
        venue: result.venue,
        doi: result.doi,
        url: result.url,
        source: result.source,
        source_id: result.source_id,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const pdf = await fetchPdf(result.pdf_url);

    const storagePath = `${user.id}/${paper.id}.pdf`;
    await supabase.storage
      .from("papers")
      .upload(storagePath, pdf, { contentType: "application/pdf", upsert: true });
    await supabase.from("papers").update({ storage_path: storagePath }).eq("id", paper.id);

    await ingestPdf({ paperId: paper.id, userId: user.id, pdf });

    return NextResponse.json({ paper: { ...paper, status: "ready" } });
  } catch (err) {
    return fail(err);
  }
}
