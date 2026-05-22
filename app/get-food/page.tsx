export default function GetFoodPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Get Food
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Recommendations will appear here. Tell me what you want this page to
          do and I'll wire it up.
        </p>
      </header>

      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Coming soon.
        </p>
      </section>
    </main>
  );
}
