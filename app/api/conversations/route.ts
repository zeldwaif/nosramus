import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { fail } from "@/lib/http";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ conversations: data ?? [] });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { title, paperIds } = (await request.json().catch(() => ({}))) as {
      title?: string;
      paperIds?: string[];
    };

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: title || "New conversation",
        paper_ids: paperIds ?? [],
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ conversation: data });
  } catch (err) {
    return fail(err);
  }
}
