import { RateForm } from "./rate-form";
import { getRecentRatings } from "./actions";
import { GroupedRatingsList } from "./components/grouped-ratings-list";

export default async function Home() {
  const recent = await getRecentRatings(150);

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

        <GroupedRatingsList
          key={`${recent[0]?.id ?? "empty"}-${recent.length}`}
          initialRatings={recent}
        />
      </main>
    </div>
  );
}
