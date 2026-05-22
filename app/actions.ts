"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export type SubmitState =
  | { status: "idle" }
  | { status: "ok"; food: string; rating: number; sentAt: string }
  | { status: "error"; error: string };

const MAX_RECENT_RATINGS = 1000;
const MAX_ANALYTICS_RATINGS = 5000;

function isThaiOrEnglish(s: string): boolean {
  // Allow Thai (U+0E00-U+0E7F), Latin letters, digits, and common punctuation.
  return /^[\u0E00-\u0E7F A-Za-z0-9 .,'\-_/&()]+$/.test(s);
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function preferredFoodName(
  food: { name_en: string | null; name_th: string | null },
  typed: string,
): string {
  const typedThai = /[\u0E00-\u0E7F]/.test(typed);
  if (typedThai) return food.name_th ?? food.name_en ?? typed;
  return food.name_en ?? food.name_th ?? typed;
}

export async function submitRating(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const foodRaw = formData.get("food");
  const foodIdRaw = formData.get("food_id");
  const ratingRaw = formData.get("rating");
  const sentAtRaw = formData.get("sentAt");

  let food = typeof foodRaw === "string" ? foodRaw.trim() : "";
  const foodId =
    typeof foodIdRaw === "string" && foodIdRaw ? Number(foodIdRaw) : null;
  const rating = typeof ratingRaw === "string" ? Number(ratingRaw) : NaN;

  if (!food) {
    return { status: "error", error: "Please enter a food." };
  }
  if (food.length > 255) {
    return { status: "error", error: "Food name is too long (max 255 chars)." };
  }
  if (!isThaiOrEnglish(food)) {
    return {
      status: "error",
      error: "Please use Thai or English characters only.",
    };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { status: "error", error: "Pick a rating from 1 to 5." };
  }

  const now = new Date();
  let sentAt = now;
  if (typeof sentAtRaw === "string" && sentAtRaw) {
    const parsed = new Date(sentAtRaw);
    const driftMs = Math.abs(parsed.getTime() - now.getTime());
    if (!Number.isNaN(parsed.getTime()) && driftMs < 24 * 60 * 60 * 1000) {
      sentAt = parsed;
    }
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // If the user didn't pick a suggestion, propose the typed name as a pending
  // food (option D: crowdsource). Best-effort - failure here doesn't block the
  // rating from being saved.
  let resolvedFoodId: number | null = null;

  if (foodId && Number.isInteger(foodId) && foodId > 0) {
    const { data: selectedFood, error: selectedFoodError } = await supabase
      .from("foods")
      .select("id, name_en, name_th")
      .eq("id", foodId)
      .eq("status", "approved")
      .maybeSingle();

    if (selectedFoodError) {
      console.error("[submitRating] selected food lookup failed:", {
        code: selectedFoodError.code,
        message: selectedFoodError.message,
        details: selectedFoodError.details,
      });
    }

    if (selectedFood?.id) {
      resolvedFoodId = selectedFood.id;
      food = preferredFoodName(selectedFood, food);
    }
  }

  if (resolvedFoodId === null) {
    const isThai = /[\u0E00-\u0E7F]/.test(food);
    const { data: pending } = await supabase
      .from("foods")
      .insert({
        name_en: isThai ? null : food,
        name_th: isThai ? food : null,
        source: "user",
        status: "pending",
      })
      .select("id")
      .maybeSingle();
    if (pending?.id) resolvedFoodId = pending.id;
  }

  let result;
  try {
    result = await supabase.from("food_ratings").insert({
      food,
      food_id: resolvedFoodId,
      rating,
      sent_at: sentAt.toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[submitRating] threw:", msg);
    return { status: "error", error: `Network error: ${msg}` };
  }

  if (result.error) {
    const e = result.error;
    console.error(
      "[submitRating] Supabase error:",
      JSON.stringify(e, Object.getOwnPropertyNames(e), 2),
    );
    return {
      status: "error",
      error: e.message || "Could not save the rating.",
    };
  }

  revalidatePath("/");
  revalidatePath("/insight");
  return { status: "ok", food, rating, sentAt: sentAt.toISOString() };
}

export type RecentRating = {
  id: number;
  food: string;
  rating: number;
  sentAt: string;
  createdAt: string;
};

export async function getRecentRatings(limit: number = 5): Promise<RecentRating[]> {
  const safeLimit = clampInt(limit, 1, MAX_RECENT_RATINGS);
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let result;
  try {
    result = await supabase
      .from("food_ratings")
      .select("id, food, rating, sent_at, created_at")
      .order("sent_at", { ascending: false })
      .limit(safeLimit);
  } catch (err) {
    console.error(
      "[getRecentRatings] threw:",
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
    return [];
  }

  const { data, error } = result;

  if (error) {
    console.error(
      "[getRecentRatings] Supabase error:",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    );
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    food: r.food,
    rating: r.rating,
    sentAt: r.sent_at,
    createdAt: r.created_at,
  }));
}

export type DailyCount = { date: string; count: number };

export type RatingSummary = {
  total: number;
  avg: number;
  distribution: { stars: number; count: number }[];
};

export async function getRatingSummary(): Promise<RatingSummary> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let result;
  try {
    result = await supabase
      .from("food_ratings")
      .select("rating")
      .order("sent_at", { ascending: false })
      .limit(MAX_ANALYTICS_RATINGS);
  } catch (err) {
    console.error(
      "[getRatingSummary] threw:",
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
    return emptyRatingSummary();
  }

  if (result.error) {
    console.error(
      "[getRatingSummary] Supabase error:",
      JSON.stringify(
        result.error,
        Object.getOwnPropertyNames(result.error),
        2,
      ),
    );
    return emptyRatingSummary();
  }

  const ratings = result.data ?? [];
  const total = ratings.length;
  const sum = ratings.reduce((acc, row) => acc + row.rating, 0);
  const distribution = [1, 2, 3, 4, 5].map((stars) => ({
    stars,
    count: ratings.filter((row) => row.rating === stars).length,
  }));

  return {
    total,
    avg: total > 0 ? sum / total : 0,
    distribution,
  };
}

function emptyRatingSummary(): RatingSummary {
  return {
    total: 0,
    avg: 0,
    distribution: [1, 2, 3, 4, 5].map((stars) => ({ stars, count: 0 })),
  };
}

/**
 * Returns rating counts per day for the last `days` days, ending today.
 * Days with zero ratings are included so the calendar grid is dense.
 */
export async function getRatingFrequency(
  days = 365,
): Promise<DailyCount[]> {
  const safeDays = clampInt(days, 1, 366);
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Anchor at start of today in the server's local time.
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - (safeDays - 1));

  let result;
  try {
    result = await supabase
      .from("food_ratings")
      .select("sent_at")
      .gte("sent_at", start.toISOString())
      .lt("sent_at", new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString());
  } catch (err) {
    console.error(
      "[getRatingFrequency] threw:",
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
    return [];
  }

  if (result.error) {
    console.error(
      "[getRatingFrequency] Supabase error:",
      JSON.stringify(
        result.error,
        Object.getOwnPropertyNames(result.error),
        2,
      ),
    );
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of result.data ?? []) {
    const d = new Date(row.sent_at as string);
    const key = formatLocalDate(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Build dense series.
  const out: DailyCount[] = [];
  for (let i = 0; i < safeDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = formatLocalDate(d);
    out.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return out;
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type FoodScatterPoint = {
  id: number;
  name: string;
  x: number;
  y: number;
  ratingCount: number;
  avgRating: number;
  bucket: "low" | "mid" | "high" | "unrated";
};

/**
 * Build a 2D scatter of foods using char n-gram TF-IDF + PCA. Only includes
 * foods that have been rated at least `minRatings` times so the chart reflects
 * actual usage rather than the full catalog.
 */
export async function getFoodScatter(
  options: { minRatings?: number; limit?: number } = {},
): Promise<FoodScatterPoint[]> {
  const minRatings = Math.max(1, options.minRatings ?? 1);
  const limit = clampInt(options.limit ?? 1000, 1, 1000);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1) Aggregate ratings by food_id in JS - PostgREST doesn't expose group-by.
  const ratingsRes = await supabase
    .from("food_ratings")
    .select("food_id, food, rating")
    .order("sent_at", { ascending: false })
    .limit(MAX_ANALYTICS_RATINGS);

  if (ratingsRes.error) {
    console.error(
      "[getFoodScatter] ratings query failed:",
      JSON.stringify(
        ratingsRes.error,
        Object.getOwnPropertyNames(ratingsRes.error),
        2,
      ),
    );
    return [];
  }

  const stats = new Map<
    string,
    { foodId: number | null; name: string; sum: number; count: number }
  >();
  for (const r of ratingsRes.data ?? []) {
    const fallbackName = String(r.food ?? "").trim();
    if (!fallbackName) continue;
    const foodId = r.food_id == null ? null : Number(r.food_id);
    const key = foodId ? `id:${foodId}` : `name:${fallbackName.toLocaleLowerCase()}`;
    const s = stats.get(key) ?? {
      foodId,
      name: fallbackName,
      sum: 0,
      count: 0,
    };
    s.sum += r.rating;
    s.count += 1;
    stats.set(key, s);
  }

  // Keep only foods with enough ratings.
  const eligibleStats = [...stats.values()]
    .filter((s) => s.count >= minRatings)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  const eligibleIds = eligibleStats
    .map((s) => s.foodId)
    .filter((id): id is number => id !== null);

  if (eligibleStats.length === 0) return [];

  // 2) Fetch the food rows for those ids.
  const foodsRes =
    eligibleIds.length > 0
      ? await supabase
          .from("foods")
          .select("id, name_en, name_th, aliases")
          .in("id", eligibleIds)
      : { data: [], error: null };

  if (foodsRes.error) {
    console.error(
      "[getFoodScatter] foods query failed:",
      JSON.stringify(
        foodsRes.error,
        Object.getOwnPropertyNames(foodsRes.error),
        2,
      ),
    );
    return [];
  }

  const { reduceToScatter } = await import("@/lib/cluster");
  const foodsById = new Map((foodsRes.data ?? []).map((f) => [f.id as number, f]));
  const rows = eligibleStats.map((s, index) => {
    const f = s.foodId ? foodsById.get(s.foodId) : null;
    const aliases = f && Array.isArray(f.aliases) ? f.aliases.join(" ") : "";
    const name = f ? (f.name_en ?? f.name_th ?? s.name).toString() : s.name;
    return {
      id: s.foodId ?? -(index + 1),
      name,
      text: f
        ? `${f.name_en ?? ""} ${f.name_th ?? ""} ${aliases}`.trim()
        : s.name,
      ratingCount: s.count,
      avgRating: s.sum / s.count,
    };
  });

  return reduceToScatter(rows);
}

export type HeatmapRating = {
  rating: number;
  sentAt: string;
};

export async function getHeatmapRatings(): Promise<HeatmapRating[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let result;
  try {
    result = await supabase
      .from("food_ratings")
      .select("rating, sent_at")
      .order("sent_at", { ascending: false })
      .limit(MAX_ANALYTICS_RATINGS);
  } catch (err) {
    console.error("[getHeatmapRatings] threw:", err);
    return [];
  }

  if (result.error) {
    console.error("[getHeatmapRatings] error:", result.error);
    return [];
  }

  return (result.data ?? []).map((r) => ({
    rating: r.rating,
    sentAt: r.sent_at,
  }));
}
