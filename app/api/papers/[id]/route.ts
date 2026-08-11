import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { fail } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
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

    const { count } = await supabase
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("paper_id", id);

    return NextResponse.json({ paper, chunk_count: count ?? 0 });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();

    const { data: paper } = await supabase
      .from("papers")
      .select("storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (paper?.storage_path) {
      await supabase.storage.from("papers").remove([paper.storage_path]);
    }

    // Chunks cascade via the FK.
    const { error } = await supabase
      .from("papers")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
