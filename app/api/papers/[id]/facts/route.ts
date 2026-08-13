import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { fail } from "@/lib/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await requireUser();
    const { id } = await params;

    const { data: paper } = await supabase
      .from("papers")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!paper) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    const { data: facts, error } = await supabase
      .from("paper_facts")
      .select("id, fact_type, key, value, evidence, page")
      .eq("paper_id", id)
      .order("fact_type")
      .order("key");

    if (error) throw new Error(error.message);

    return NextResponse.json({ facts: facts ?? [] });
  } catch (err) {
    return fail(err);
  }
}
