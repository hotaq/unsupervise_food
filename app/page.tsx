import { RateForm } from "./rate-form";
import { getRecentRatings } from "./actions";

export default async function Home() {
  const recent = await getRecentRatings();

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-10">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Food Recommend
          </h1>
          <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Type the food you ate, pick a star rating, and submit.
          </p>
        </header>

        <RateForm />

        {recent.length > 0 && (
          <section className="w-full">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Recent
            </h2>
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">
                      {r.food}
                    </span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-500">
                      {new Date(r.sentAt).toLocaleString()}
                    </span>
                  </div>
                  <span className="shrink-0 text-amber-400" aria-label={`${r.rating} of 5`}>
                    {"★".repeat(r.rating)}
                    <span className="text-zinc-300 dark:text-zinc-700">
                      {"★".repeat(5 - r.rating)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
