"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import type { DailyCount } from "../actions";

type Props = {
  data: DailyCount[];
  weeks?: number;
};

// 5 levels including zero, mapped to amber tints to match the rest of the UI.
const LIGHT_LEVELS = [
  "#f4f4f5", // zinc-100 (zero)
  "#fde68a", // amber-200
  "#fcd34d", // amber-300
  "#fbbf24", // amber-400
  "#f59e0b", // amber-500
];
const DARK_LEVELS = [
  "#1f1f23",
  "#78350f",
  "#b45309",
  "#d97706",
  "#f59e0b",
];

const DAY_LABELS = ["Mon", "Wed", "Fri"];

function levelFor(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function parseUTCDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const fullDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function RatingCalendar({ data }: Props) {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<30 | 90 | 180 | 365>(365);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [mounted]);

  // Always render a Sunday-anchored grid so columns line up by week.
  const grid = useMemo(() => buildGrid(data), [data]);

  const activeDates = useMemo(() => {
    const sliced = data.slice(-range);
    return new Set(sliced.map((d) => d.date));
  }, [data, range]);

  const filteredCells = useMemo(() => {
    return grid.cells.map((c) => {
      if (!c) return null;
      const isActive = activeDates.has(c.date);
      return {
        ...c,
        count: isActive ? c.count : 0,
      };
    });
  }, [grid.cells, activeDates]);

  const max = useMemo(
    () => filteredCells.reduce((m, c) => (c && c.count > m ? c.count : m), 0),
    [filteredCells],
  );
  const total = useMemo(
    () => filteredCells.reduce((s, c) => s + (c?.count ?? 0), 0),
    [filteredCells],
  );
  const activeDays = useMemo(
    () => filteredCells.filter((c) => c && c.count > 0).length,
    [filteredCells],
  );

  const cell = 12;
  const gap = 3;
  const dayLabelWidth = 24;
  const monthLabelHeight = 16;
  const paddingTop = 26; // Add top space within the SVG for tooltips to render without clipping
  const width = dayLabelWidth + grid.weeks * (cell + gap);
  const height = paddingTop + monthLabelHeight + 7 * (cell + gap);

  const [hover, setHover] = useState<{
    x: number;
    y: number;
    date: string;
    count: number;
  } | null>(null);

  if (!mounted) {
    return (
      <div className="h-[210px] w-full rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 animate-pulse" />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* GitHub Header Above the Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <h3 className="text-sm font-normal text-zinc-900 dark:text-zinc-100">
          <span className="font-semibold">{total}</span> rating{total === 1 ? "" : "s"} in the{" "}
          {range === 365 ? "last year" : `last ${range} days`}
        </h3>

        {/* Dynamic Range Toggles */}
        <div className="flex items-center gap-1 rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-900 self-start sm:self-auto border border-zinc-200 dark:border-zinc-800">
          {([30, 90, 180, 365] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-sm px-2 py-0.5 text-2xs font-medium transition-all cursor-pointer ${
                range === r
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {r === 365 ? "1 Year" : `${r} Days`}
            </button>
          ))}
        </div>
      </div>

      {/* GitHub Style Contribution Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div ref={containerRef} className="relative overflow-x-auto scrollbar-thin">
          <svg width={width} height={height} className="block">
            {/* Day labels on the left */}
            {[1, 3, 5].map((dayIdx, i) => (
              <text
                key={dayIdx}
                x={0}
                y={paddingTop + monthLabelHeight + dayIdx * (cell + gap) + cell - 2}
                fontSize="10"
                className="fill-zinc-500 dark:fill-zinc-500"
              >
                {DAY_LABELS[i]}
              </text>
            ))}

            {/* Month labels on top */}
            {grid.monthLabels.map((m) => (
              <text
                key={`${m.label}-${m.weekIndex}`}
                x={dayLabelWidth + m.weekIndex * (cell + gap)}
                y={paddingTop + monthLabelHeight - 4}
                fontSize="10"
                className="fill-zinc-500 dark:fill-zinc-500"
              >
                {m.label}
              </text>
            ))}

            {/* Cells */}
            {filteredCells.map((c, i) => {
              if (!c) return null;
              const week = Math.floor(i / 7);
              const day = i % 7;
              const x = dayLabelWidth + week * (cell + gap);
              const y = paddingTop + monthLabelHeight + day * (cell + gap);
              const lvl = levelFor(c.count, max);
              return (
                <rect
                  key={c.date}
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx={2}
                  ry={2}
                  className={`cursor-default cal-bg-${lvl}`}
                  onMouseEnter={() => {
                    setHover({
                      x: x + cell / 2,
                      y: y,
                      date: c.date,
                      count: c.count,
                    });
                  }}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}

            {hover && (() => {
              const tooltipWidth = 180;
              const tooltipHeight = 26;
              const arrowHeight = 5;

              // Center tooltip horizontally above cell but clamp it to SVG width boundaries
              let rectX = hover.x - tooltipWidth / 2;
              if (rectX < 4) rectX = 4;
              if (rectX + tooltipWidth > width - 4) rectX = width - tooltipWidth - 4;

              // Position tooltip vertically above the cell
              const rectY = hover.y - arrowHeight - tooltipHeight;

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
                  {/* Pointer arrow pointing to hovered cell */}
                  <polygon
                    points={`
                      ${hover.x - 5},${rectY + tooltipHeight}
                      ${hover.x + 5},${rectY + tooltipHeight}
                      ${hover.x},${hover.y - 1}
                    `}
                    className="fill-zinc-900 dark:fill-zinc-950 stroke-zinc-800/40 dark:stroke-zinc-800/60"
                    strokeWidth="1"
                  />
                  {/* Mask stroke of polygon edge touching the rect bottom boundary */}
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
                    fontSize="11"
                    className="fill-zinc-100 dark:fill-zinc-100 font-medium"
                  >
                    {hover.count} rating{hover.count === 1 ? "" : "s"} on{" "}
                    {fullDateFmt.format(parseUTCDate(hover.date))}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Footer */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800/60">
          <a
            href="#"
            className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-350 hover:underline"
            onClick={(e) => e.preventDefault()}
          >
            Learn how we count ratings
          </a>
          <Legend />
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
      <span>Less</span>
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            aria-hidden
            className={`h-3 w-3 rounded-sm cal-bg-${lvl}`}
          />
        ))}
      </div>
      <span>More</span>
    </div>
  );
}

function buildGrid(data: DailyCount[]): {
  cells: (DailyCount | null)[];
  weeks: number;
  monthLabels: { label: string; weekIndex: number }[];
} {
  if (data.length === 0) {
    return { cells: [], weeks: 0, monthLabels: [] };
  }

  // Pad the start so the first column begins on Sunday (day 0).
  const first = parseUTCDate(data[0].date);
  const padBefore = first.getUTCDay(); // 0 = Sunday
  const cells: (DailyCount | null)[] = [];
  for (let i = 0; i < padBefore; i++) cells.push(null);
  for (const c of data) cells.push(c);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = cells.length / 7;

  // Month labels: show the month at the first week containing day 1..7 of a month.
  const labels: { label: string; weekIndex: number }[] = [];
  let currentMonth = -1;
  let lastLabelWeekIndex = -10;
  for (let w = 0; w < weeks; w++) {
    const cell = cells[w * 7] || cells[w * 7 + 6]; // Sunday or Saturday cell
    if (!cell) continue;
    const d = parseUTCDate(cell.date);
    if (d.getUTCMonth() !== currentMonth) {
      currentMonth = d.getUTCMonth();
      if (w - lastLabelWeekIndex >= 3) {
        labels.push({ label: monthFmt.format(d), weekIndex: w });
        lastLabelWeekIndex = w;
      }
    }
  }

  return { cells, weeks, monthLabels: labels };
}
