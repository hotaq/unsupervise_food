"use client";

import { useActionState, useEffect, useState } from "react";
import { submitRating, type SubmitState } from "./actions";
import { FoodCombobox } from "./components/food-combobox";

const initialState: SubmitState = { status: "idle" };

export function RateForm() {
  const [state, formAction, pending] = useActionState(submitRating, initialState);
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [sentAt, setSentAt] = useState<string>("");

  const active = hover || rating;

  useEffect(() => {
    if (state.status === "ok") {
      setRating(0);
      setHover(0);
    }
  }, [state]);

  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <form
        action={formAction}
        onSubmit={() => setSentAt(new Date().toISOString())}
        className="flex flex-col gap-4"
      >
        <label
          htmlFor="food"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          What did you eat?
        </label>
        <FoodCombobox required />
        <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          Type in Thai or English. Pick a suggestion or just submit your own.
        </p>

        <div
          className="flex items-center justify-center gap-1"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={rating === n}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className="rounded-md p-1 text-3xl leading-none transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 dark:focus-visible:ring-zinc-100/30"
            >
              <span
                className={
                  n <= active
                    ? "text-amber-400"
                    : "text-zinc-300 dark:text-zinc-700"
                }
              >
                ★
              </span>
            </button>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating} />
        <input type="hidden" name="sentAt" value={sentAt} />

        <button
          type="submit"
          disabled={pending || rating === 0}
          className="self-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving..." : "Submit rating"}
        </button>
      </form>

      {state.status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </div>
      )}
    </div>
  );
}
