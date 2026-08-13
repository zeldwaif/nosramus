import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { ingestPdf } from "@/lib/ingest";
import { extractPdf } from "@/lib/pdf";
import { fail } from "@/lib/http";

export const maxDuration = 300;

const MAX_BYTES = 30 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "PDF is larger than 30 MB" }, { status: 400 });
    }

    const buf = await file.arrayBuffer();
    const { guessedTitle } = await extractPdf(buf);

    const title =
      (form.get("title") as string | null)?.trim() ||
      guessedTitle ||
      file.name.replace(/\.pdf$/i, "");

    const storagePath = `${user.id}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("papers")
      .upload(storagePath, buf, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: paper, error } = await supabase
      .from("papers")
      .insert({
        user_id: user.id,
        title,
        source: "upload",
        storage_path: storagePath,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await ingestPdf({ paperId: paper.id, userId: user.id, pdf: buf });

    const { data: updated, error: fetchError } = await supabase
      .from("papers")
      .select("*")
      .eq("id", paper.id)
      .single();
    if (fetchError) throw new Error(fetchError.message);

    return NextResponse.json({ paper: updated });
  } catch (err) {
    return fail(err);
  }
}
