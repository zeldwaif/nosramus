import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { fetchPdf, ingestPdf } from "@/lib/ingest";
import { resolveIdentifier } from "@/lib/sources/resolve";
import { fail } from "@/lib/http";
import type { SearchResult } from "@/lib/types";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const maxDuration = 300;

async function markPaperFailed(
  supabase: SupabaseClient,
  user: User,
  paperId: string,
  message: string
) {
  await supabase
    .from("papers")
    .update({ status: "failed", error: message })
    .eq("id", paperId)
    .eq("user_id", user.id);
}

/**
 * Import a paper found via search. Accepts either a full SearchResult (from the
 * search endpoint) or a bare `identifier` string to resolve first.
 */
export async function POST(request: Request) {
  let paperId: string | undefined;
  let supabase: SupabaseClient | undefined;
  let user: User | undefined;

  try {
    ({ supabase, user } = await requireUser());
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

    paperId = paper.id as string;

    const pdf = await fetchPdf(result.pdf_url);

    const storagePath = `${user.id}/${paper.id}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("papers")
      .upload(storagePath, pdf, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { error: pathError } = await supabase
      .from("papers")
      .update({ storage_path: storagePath })
      .eq("id", paper.id);
    if (pathError) throw new Error(pathError.message);

    await ingestPdf({ paperId: paper.id, userId: user.id, pdf });

    const { data: updated, error: fetchError } = await supabase
      .from("papers")
      .select("*")
      .eq("id", paper.id)
      .single();
    if (fetchError) throw new Error(fetchError.message);

    return NextResponse.json({ paper: updated });
  } catch (err) {
    if (paperId && supabase && user) {
      const message = err instanceof Error ? err.message : "Import failed";
      await markPaperFailed(supabase, user, paperId, message);
    }
    return fail(err);
  }
}
