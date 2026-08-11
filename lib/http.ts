import { NextResponse } from "next/server";
import { UnauthorizedError } from "./supabase/server";

export function fail(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const message = err instanceof Error ? err.message : "Something went wrong";
  console.error("[nosramus]", err);
  return NextResponse.json({ error: message }, { status: 500 });
}
