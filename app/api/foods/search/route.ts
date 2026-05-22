import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type FoodRow = {
  id: number;
  name_en: string | null;
  name_th: string | null;
  aliases: string[] | null;
};

const MAX_QUERY_LENGTH = 80;

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ items: [] });
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: "Search query is too long.", items: [] },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1) Preferred path: ranked RPC backed by pg_trgm similarity().
  const rpc = await supabase.rpc("search_foods", { q, max_results: 10 });
  if (!rpc.error) {
    return NextResponse.json({ items: rpc.data ?? [], mode: "rpc" });
  }

  const isMissingFn =
    rpc.error.code === "PGRST202" || // PostgREST: function not found in schema cache
    /function .*search_foods/i.test(rpc.error.message ?? "");

  if (!isMissingFn) {
    console.error("[/api/foods/search] rpc error:", {
      code: rpc.error.code,
      message: rpc.error.message,
      details: rpc.error.details,
    });
    return NextResponse.json(
      { error: rpc.error.message, items: [] },
      { status: 500 },
    );
  }

  // 2) Fallback: structured ILIKE queries across names. Slower and less complete
  // than the RPC, but works before 02_search_rpc.sql has been applied.
  const safe = escapeLikePattern(q);
  const like = `%${safe}%`;
  const [nameEnRes, nameThRes] = await Promise.all([
    supabase
      .from("foods")
      .select("id, name_en, name_th, aliases")
      .eq("status", "approved")
      .ilike("name_en", like)
      .limit(10),
    supabase
      .from("foods")
      .select("id, name_en, name_th, aliases")
      .eq("status", "approved")
      .ilike("name_th", like)
      .limit(10),
  ]);

  const error = nameEnRes.error ?? nameThRes.error;
  if (error) {
    console.error("[/api/foods/search] fallback error:", {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return NextResponse.json(
      { error: error.message, items: [] },
      { status: 500 },
    );
  }

  const merged = new Map<number, FoodRow>();
  for (const item of [...(nameEnRes.data ?? []), ...(nameThRes.data ?? [])]) {
    if (!merged.has(item.id)) merged.set(item.id, item as FoodRow);
    if (merged.size >= 10) break;
  }

  return NextResponse.json({ items: [...merged.values()], mode: "ilike" });
}
