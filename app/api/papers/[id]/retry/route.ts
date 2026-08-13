import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { ingestPdf } from "@/lib/ingest";
import { fail } from "@/lib/http";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/** Re-run ingestion for a failed paper that still has a stored PDF. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();

    const { data: paper, error } = await supabase
      .from("papers")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (error) throw new Error(error.message);

    if (!paper.storage_path) {
      return NextResponse.json(
        { error: "No stored PDF to retry. Re-import or upload the paper." },
        { status: 422 }
      );
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from("papers")
      .download(paper.storage_path);
    if (downloadError || !file) {
      throw new Error(downloadError?.message ?? "Could not download the PDF.");
    }

    const pdf = await file.arrayBuffer();
    await ingestPdf({ paperId: paper.id, userId: user.id, pdf });

    const { data: updated } = await supabase
      .from("papers")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({ paper: updated });
  } catch (err) {
    return fail(err);
  }
}
