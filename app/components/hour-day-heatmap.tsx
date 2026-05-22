"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import type { HeatmapRating } from "../actions";

type Props = {
  data: HeatmapRating[];
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Day mapping corresponding to DAY_LABELS row indices: Mon (1), Tue (2), Wed (3), Thu (4), Fri (5), Sat (6), Sun (0)
const ROW_DAYS = [1, 2, 3, 4, 5, 6, 0];

export function HourDayHeatmap({ data }: Props) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"enjoyment" | "frequency">("enjoyment");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Build the 7x24 grid cells in the user's actual browser local timezone
  const cells = useMemo(() => {
    const grid = Array.from({ length: 7 }, (_, rIdx) => {
      const day = ROW_DAYS[rIdx];
      return Array.from({ length: 24 }, (_, hour) => ({
        day,
        hour,
        count: 0,
        ratingSum: 0,
        avgRating: 0,
      }));
    });

    for (const r of data) {
      const d = new Date(r.sentAt);
      const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const hour = d.getHours(); // 0 to 23

      const rIdx = ROW_DAYS.indexOf(day);
      if (rIdx !== -1) {
        const cell = grid[rIdx][hour];
        cell.count += 1;
        cell.ratingSum += r.rating;
      }
    }

    for (let r = 0; r < 7; r++) {
      for (let h = 0; h < 24; h++) {
        const cell = grid[r][h];
        cell.avgRating = cell.count > 0 ? cell.ratingSum / cell.count : 0;
      }
    }

    return grid.flat();
  }, [data]);

  // Compute maximum metrics for visual coloring thresholds
  const maxCount = useMemo(() => cells.reduce((m, c) => Math.max(m, c.count), 0), [cells]);

  // Dynamically calculate habits and cravings insights
  const insights = useMemo(() => {
    if (data.length === 0) return null;

    let peakEatCell = null;
    let peakEnjoyCell = null;

    for (const c of cells) {
      if (c.count > 0) {
        if (!peakEatCell || c.count > peakEatCell.count) {
          peakEatCell = c;
        }
        // Peak enjoyment slot: has high average rating and at least 1 rating
        if (c.avgRating >= 4.0) {
          if (
            !peakEnjoyCell ||
            c.avgRating > peakEnjoyCell.avgRating ||
            (c.avgRating === peakEnjoyCell.avgRating && c.count > peakEnjoyCell.count)
          ) {
            peakEnjoyCell = c;
          }
        }
      }
    }

    const getDayName = (dayNum: number) => {
      return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayNum];
    };

    const formatHour = (h: number) => {
      if (h === 0) return "midnight";
      if (h === 12) return "noon";
      return h > 12 ? `${h - 12} PM` : `${h} AM`;
    };

    return {
      peakEat: peakEatCell
        ? `${getDayName(peakEatCell.day)}s around ${formatHour(peakEatCell.hour)}`
        : null,
      peakEnjoy: peakEnjoyCell
        ? `${getDayName(peakEnjoyCell.day)}s around ${formatHour(peakEnjoyCell.hour)} (${peakEnjoyCell.avgRating.toFixed(1)} ★)`
        : null,
    };
  }, [cells, data]);

  const cell = 14;
  const gap = 2;
  const rowLabelWidth = 32;
  const colLabelHeight = 16;
  const paddingTop = 26; // extra spacing at the top of the SVG for tooltips to display without clipping
  const width = rowLabelWidth + 24 * (cell + gap);
  const height = paddingTop + colLabelHeight + 7 * (cell + gap);

  const [hover, setHover] = useState<{
    x: number;
    y: number;
    day: number;
    hour: number;
    count: number;
    avgRating: number;
  } | null>(null);

  if (!mounted) {
    return (
      <div className="h-[210px] w-full rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 animate-pulse" />
    );
  }

  // Visual level calculator depending on active selection mode
  const getLevelForCell = (c: typeof cells[0]) => {
    if (c.count === 0) return 0;
    if (mode === "frequency") {
      if (maxCount <= 0) return 0;
      const ratio = c.count / maxCount;
      if (ratio <= 0.25) return 1;
      if (ratio <= 0.5) return 2;
      if (ratio <= 0.75) return 3;
      return 4;
    } else {
      // average ratings (1-5 range)
      if (c.avgRating < 2.0) return 1;
      if (c.avgRating < 3.5) return 2;
      if (c.avgRating < 4.5) return 3;
      return 4;
    }
  };

  const getDayNameShort = (dayNum: number) => {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayNum];
  };

  const formatHourShort = (h: number) => {
    if (h === 0) return "12 AM";
    if (h === 12) return "12 PM";
    return h > 12 ? `${h - 12} PM` : `${h} AM`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Subheader Split with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-normal text-zinc-900 dark:text-zinc-100">
            &quot;When do I enjoy food most?&quot;
          </h3>
          <p className="text-2xs text-zinc-500 dark:text-zinc-500 leading-tight">
            Spots Friday-night spicy cravings vs Sunday brunch moods.
          </p>
        </div>

        {/* Toggle between Satisfaction and Frequency */}
        <div className="flex items-center gap-1 rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-900 self-start sm:self-auto border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setMode("enjoyment")}
            className={`rounded-sm px-2.5 py-0.5 text-2xs font-medium transition-all cursor-pointer ${
              mode === "enjoyment"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Satisfaction
          </button>
          <button
            onClick={() => setMode("frequency")}
            className={`rounded-sm px-2.5 py-0.5 text-2xs font-medium transition-all cursor-pointer ${
              mode === "frequency"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Frequency
          </button>
        </div>
      </div>

      {/* Heatmap Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block">
            {/* Weekday Row Labels */}
            {DAY_LABELS.map((dayLabel, rIdx) => (
              <text
                key={dayLabel}
                x={0}
                y={paddingTop + colLabelHeight + rIdx * (cell + gap) + cell - 2}
                fontSize="10"
                className="fill-zinc-500 dark:fill-zinc-500 font-medium"
              >
                {dayLabel}
              </text>
            ))}

            {/* Selected Column Time Labels (spaced every 3 hours to avoid overlap) */}
            {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
              <text
                key={h}
                x={rowLabelWidth + h * (cell + gap) + cell / 2}
                y={paddingTop + colLabelHeight - 5}
                fontSize="9"
                textAnchor="middle"
                className="fill-zinc-400 dark:fill-zinc-500"
              >
                {h === 0 ? "12A" : h === 12 ? "12P" : h > 12 ? `${h - 12}P` : `${h}A`}
              </text>
            ))}

            {/* Grid Squares */}
            {cells.map((c, idx) => {
              const rIdx = ROW_DAYS.indexOf(c.day);
              const x = rowLabelWidth + c.hour * (cell + gap);
              const y = paddingTop + colLabelHeight + rIdx * (cell + gap);
              const lvl = getLevelForCell(c);

              return (
                <rect
                  key={`${c.day}-${c.hour}`}
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx={2.5}
                  ry={2.5}
                  className={`cursor-default cal-bg-${lvl} transition-colors duration-150`}
                  onMouseEnter={() => {
                    setHover({
                      x: x + cell / 2,
                      y,
                      day: c.day,
                      hour: c.hour,
                      count: c.count,
                      avgRating: c.avgRating,
                    });
                  }}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}

            {/* Dynamic Arrow Tooltip */}
            {hover && (() => {
              const tooltipWidth = 200;
              const tooltipHeight = 26;
              const arrowHeight = 5;

              // Center horizontally and clamp to SVG width boundaries
              let rectX = hover.x - tooltipWidth / 2;
              if (rectX < 4) rectX = 4;
              if (rectX + tooltipWidth > width - 4) rectX = width - tooltipWidth - 4;

              // Position vertically above hovered square
              const rectY = hover.y - arrowHeight - tooltipHeight;

              const dayName = getDayNameShort(hover.day);
              const hourName = formatHourShort(hover.hour);
              const countText = `${hover.count} rating${hover.count === 1 ? "" : "s"}`;
              const ratingText = hover.count > 0 ? ` (${hover.avgRating.toFixed(1)} ★)` : "";

              return (
                <g pointerEvents="none">
                  {/* Tooltip background */}
                  <rect
                    x={rectX}
                    y={rectY}
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx={4}
                    ry={4}
                    className="fill-zinc-900 dark:fill-zinc-950 stroke-zinc-800/40 dark:stroke-zinc-800/60"
                    strokeWidth="1"
                  />
                  {/* Pointer arrow */}
                  <polygon
                    points={`
                      ${hover.x - 5},${rectY + tooltipHeight}
                      ${hover.x + 5},${rectY + tooltipHeight}
                      ${hover.x},${hover.y - 1}
                    `}
                    className="fill-zinc-900 dark:fill-zinc-950 stroke-zinc-800/40 dark:stroke-zinc-800/60"
                    strokeWidth="1"
                  />
                  {/* Seamless blending edge line */}
                  <line
                    x1={hover.x - 4}
                    y1={rectY + tooltipHeight}
                    x2={hover.x + 4}
                    y2={rectY + tooltipHeight}
                    className="stroke-zinc-900 dark:stroke-zinc-950"
                    strokeWidth="1.5"
                  />
                  {/* Tooltip content text */}
                  <text
                    x={rectX + tooltipWidth / 2}
                    y={rectY + 17}
                    textAnchor="middle"
                    fontSize="10"
                    className="fill-zinc-100 dark:fill-zinc-100 font-medium"
                  >
                    {dayName} {hourName}: {countText}{ratingText}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Heatmap Footer Legend & Dynamic Insights */}
        <div className="mt-3 flex flex-col gap-3.5 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800/60">
          {/* Dynamic Habit Cravings Insight */}
          {insights && (insights.peakEat || insights.peakEnjoy) && (
            <div className="flex flex-col gap-1 rounded-md bg-zinc-50 dark:bg-zinc-900/60 p-2.5 border border-zinc-200/50 dark:border-zinc-800/50">
              <span className="text-3xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold">
                Your eating insights
              </span>
              <div className="flex flex-col gap-1 text-2xs text-zinc-600 dark:text-zinc-400">
                {insights.peakEat && (
                  <div>
                    🍽️ You log the most ratings on{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                      {insights.peakEat}
                    </span>
                    .
                  </div>
                )}
                {insights.peakEnjoy && (
                  <div>
                    ✨ Your food enjoyment peaks on{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                      {insights.peakEnjoy}
                    </span>
                    !
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legend and Caption */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-2xs text-zinc-400 dark:text-zinc-500">
              {mode === "enjoyment"
                ? "Shaded by average rating score (shades of Amber)"
                : "Shaded by relative frequency of logging"}
            </span>
            <div className="flex items-center gap-2 text-2xs text-zinc-400 dark:text-zinc-500">
              <span>Less / Low</span>
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((lvl) => (
                  <span
                    key={lvl}
                    aria-hidden
                    className={`h-3 w-3 rounded-sm cal-bg-${lvl}`}
                  />
                ))}
              </div>
              <span>More / High</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
