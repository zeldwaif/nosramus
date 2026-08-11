import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { fail } from "@/lib/http";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();

    const { data, error } = await supabase
      .from("papers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ papers: data ?? [] });
  } catch (err) {
    return fail(err);
  }
}
