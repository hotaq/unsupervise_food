const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Manually parse .env.local
try {
  const content = fs.readFileSync(path.join(__dirname, ".env.local"), "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.error("Could not load env file:", e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key in process.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("--- System Time Info ---");
  console.log("Current System Date (Local):", new Date().toString());
  console.log("Current System Date (ISO/UTC):", new Date().toISOString());
  console.log("Timezone Offset (mins):", new Date().getTimezoneOffset());

  try {
    const { data: ratings, error } = await supabase
      .from("food_ratings")
      .select("id, food, rating, sent_at, created_at")
      .order("sent_at", { ascending: false });

    if (error) {
      console.error("Supabase query error:", error);
      return;
    }

    console.log("\n--- Database Ratings found (Total:", ratings.length, ") ---");
    ratings.slice(0, 10).forEach(r => {
      console.log(`ID: ${r.id} | Food: ${r.food} | Rating: ${r.rating} | sent_at: ${r.sent_at} | created_at: ${r.created_at}`);
    });

    // Run the logic from getRatingFrequency manually to see what keys it generates
    console.log("\n--- Simulated getRatingFrequency Logic ---");
    const days = 365;
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));

    console.log("Simulated start:", start.toISOString(), "(Local:", start.toString(), ")");
    console.log("Simulated end:", end.toISOString(), "(Local:", end.toString(), ")");

    const endPlus1 = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    console.log("Query bounds: >= ", start.toISOString(), " < ", endPlus1.toISOString());

    const filtered = ratings.filter(r => {
      const sent = r.sent_at;
      return sent >= start.toISOString() && sent < endPlus1.toISOString();
    });

    console.log("Number of ratings in simulated window:", filtered.length);

    const counts = new Map();
    for (const r of filtered) {
      const d = new Date(r.sent_at);
      const key = formatLocalDate(d);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      console.log(`Row: ${r.sent_at} -> Key: ${key}`);
    }

    console.log("\nCounts Map generated:");
    console.log([...counts.entries()]);

  } catch (err) {
    console.error("Exception occurred:", err);
  }
}

function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

run();
