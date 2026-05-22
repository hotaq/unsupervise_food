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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ items: [] });
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

  // 2) Fallback: ILIKE OR across name + aliases. Slower, no ranking, but works
  // even before 02_search_rpc.sql has been applied. Searches name_en, name_th,
  // and the aliases array. We escape % and _ in the user query.
  const safe = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const like = `%${safe}%`;
  const { data, error } = await supabase
    .from("foods")
    .select("id, name_en, name_th, aliases")
    .eq("status", "approved")
    .or(`name_en.ilike.${like},name_th.ilike.${like}`)
    .limit(10);

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

  return NextResponse.json({ items: (data ?? []) as FoodRow[], mode: "ilike" });
}
