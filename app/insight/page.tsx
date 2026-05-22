import {
  getFoodScatter,
  getRatingFrequency,
  getHeatmapRatings,
  getRatingSummary,
} from "../actions";
import { FoodClusterScatter } from "../components/food-cluster-scatter";
import { RatingCalendar } from "../components/rating-calendar";
import { HourDayHeatmap } from "../components/hour-day-heatmap";
import { InsightAutoRefresh } from "../components/insight-auto-refresh";

export const dynamic = "force-dynamic";

export default async function InsightPage() {
  const [summary, scatter, frequency, heatmapRatings] = await Promise.all([
    getRatingSummary(),
    getFoodScatter({ minRatings: 1, limit: 1000 }),
    getRatingFrequency(365),
    getHeatmapRatings(),
  ]);

  const max = Math.max(1, ...summary.distribution.map((d) => d.count));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <InsightAutoRefresh />
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Insight
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          A quick look at the most recent ratings and how foods cluster.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Ratings analyzed" value={summary.total.toString()} />
        <Stat
          label="Average score"
          value={summary.total > 0 ? `${summary.avg.toFixed(2)} / 5` : "--"}
        />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Distribution
        </h2>
        <ul className="flex flex-col gap-3">
          {summary.distribution
            .slice()
            .reverse()
            .map(({ stars, count }) => (
              <li key={stars} className="flex items-center gap-3">
                <span
                  className="w-28 shrink-0 text-base leading-none tracking-tight"
                  aria-label={`${stars} star${stars > 1 ? "s" : ""}`}
                >
                  <span className="text-amber-400">{"★".repeat(stars)}</span>
                  <span className="text-zinc-300 dark:text-zinc-700">
                    {"★".repeat(5 - stars)}
                  </span>
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-[width] duration-500 ease-out dark:bg-zinc-100"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                  {count}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Rating frequency
        </h2>
        <RatingCalendar data={frequency} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Hour × day heatmap
        </h2>
        <HourDayHeatmap data={heatmapRatings} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Food cluster
        </h2>
        <FoodClusterScatter points={scatter} />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}
