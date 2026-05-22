"use client";

import { useState, useMemo, useTransition } from "react";
import type { RecentRating } from "../actions";
import { getRecentRatings } from "../actions";

type Props = {
  initialRatings: RecentRating[];
};

export function GroupedRatingsList({ initialRatings }: Props) {
  const [ratings, setRatings] = useState<RecentRating[]>(initialRatings);
  const [visibleDaysCount, setVisibleDaysCount] = useState(7);
  const [dbLimit, setDbLimit] = useState(150);
  const [hasMoreInDb, setHasMoreInDb] = useState(initialRatings.length >= 150);
  const [isPending, startTransition] = useTransition();

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    if (isSameDay(d, today)) return "Today";
    if (isSameDay(d, yesterday)) return "Yesterday";

    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Group ratings by date in the user's browser local timezone
  const grouped = useMemo(() => {
    const groups: { [key: string]: RecentRating[] } = {};

    for (const r of ratings) {
      const localDate = new Date(r.sentAt);
      const y = localDate.getFullYear();
      const m = String(localDate.getMonth() + 1).padStart(2, "0");
      const d = String(localDate.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${d}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(r);
    }

    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedKeys.map((key) => ({
      dateStr: key,
      label: getDayLabel(key),
      entries: groups[key].sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      ),
    }));
  }, [ratings]);

  const visibleGroups = useMemo(() => {
    return grouped.slice(0, visibleDaysCount);
  }, [grouped, visibleDaysCount]);

  const loadMoreDays = () => {
    const nextVisibleDays = visibleDaysCount + 7;

    if (grouped.length < nextVisibleDays && hasMoreInDb && !isPending) {
      startTransition(async () => {
        const newLimit = dbLimit + 150;
        const more = await getRecentRatings(newLimit);
        setRatings(more);
        setDbLimit(newLimit);
        if (more.length < newLimit) {
          setHasMoreInDb(false);
        }
      });
    }

    setVisibleDaysCount(nextVisibleDays);
  };

  if (ratings.length === 0) return null;

  return (
    <section className="w-full">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Recent Ratings
      </h2>
      <div className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {visibleGroups.map((group) => (
          <div key={group.dateStr} className="flex flex-col">
            {/* Day Header with collapsed entry counts */}
            <div className="flex items-center justify-between bg-zinc-50/75 px-5 py-2.5 dark:bg-zinc-900/40 border-b border-zinc-100 dark:border-zinc-800/40">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {group.label}
              </span>
              <span className="text-2xs font-medium text-zinc-400 dark:text-zinc-500">
                {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            {/* Entries list inside this day */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-900/60">
              {group.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-zinc-50/20 dark:hover:bg-zinc-900/10"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {entry.food}
                    </span>
                    <span className="block text-3xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {formatTime(entry.sentAt)}
                    </span>
                  </div>
                  <span
                    className="shrink-0 text-xs text-amber-400 tracking-wide font-normal"
                    aria-label={`${entry.rating} of 5`}
                  >
                    {"★".repeat(entry.rating)}
                    <span className="text-zinc-200 dark:text-zinc-800/80">
                      {"★".repeat(5 - entry.rating)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Load Earlier Days Button */}
        {(visibleDaysCount < grouped.length || hasMoreInDb) && (
          <button
            onClick={loadMoreDays}
            disabled={isPending}
            className="w-full py-3.5 text-center text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 border-t border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/40 rounded-b-2xl disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load earlier days ↓"}
          </button>
        )}
      </div>
    </section>
  );
}
