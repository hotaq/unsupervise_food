"use client";

import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import {
  ChartsTooltipContainer,
  useItemTooltip,
} from "@mui/x-charts/ChartsTooltip";
import { ScatterChart, type ScatterChartProps } from "@mui/x-charts/ScatterChart";
import { useMemo } from "react";
import type { FoodScatterPoint } from "../actions";
import { useMounted } from "./use-mounted";

type Props = {
  points: FoodScatterPoint[];
};

const BUCKETS = ["high", "mid", "low", "unrated"] as const;
type Bucket = (typeof BUCKETS)[number];

const COLORS: Record<Bucket, string> = {
  high: "#f59e0b",
  mid: "#71717a",
  low: "#a1a1aa",
  unrated: "#d4d4d8",
};

const LABELS: Record<Bucket, string> = {
  high: "Highly rated (≥ 4)",
  mid: "Mid (3-4)",
  low: "Low (< 3)",
  unrated: "No ratings yet",
};

// Module-scoped lookup so the custom tooltip (rendered by MUI) can resolve a
// point by series + index without prop drilling.
const POINT_LOOKUP: Map<string, FoodScatterPoint[]> = new Map();

export function FoodClusterScatter({ points }: Props) {
  const mounted = useMounted();

  const { series, hasData } = useMemo(() => {
    POINT_LOOKUP.clear();

    const grouped = BUCKETS.map((bucket) => {
      const subset = points.filter((p) => p.bucket === bucket);
      POINT_LOOKUP.set(bucket, subset);
      return {
        id: bucket,
        label: LABELS[bucket],
        color: COLORS[bucket],
        markerSize: 7,
        highlightScope: { highlight: "item", fade: "global" } as const,
        data: subset.map((p, idx) => ({ id: idx, x: p.x, y: p.y })),
      };
    }).filter((s) => s.data.length > 0);

    return { series: grouped, hasData: grouped.length > 0 };
  }, [points]);

  if (!mounted) {
    return (
      <div className="h-[436px] w-full rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 animate-pulse" />
    );
  }

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-500">
        Not enough data yet. Submit a few ratings to populate the cluster.
      </div>
    );
  }

  const params: ScatterChartProps = {
    series,
    height: 440,
    hitAreaRadius: 28,
    xAxis: [{ disableLine: true, disableTicks: true, tickLabelStyle: { display: "none" } }],
    yAxis: [{ disableLine: true, disableTicks: true, tickLabelStyle: { display: "none" } }],
    grid: { vertical: false, horizontal: false },
    margin: { left: 24, right: 24, top: 54, bottom: 54 },
    slotProps: {
      legend: {
        position: { vertical: "top", horizontal: "center" },
        sx: { justifyContent: "center" },
      },
    },
    slots: { tooltip: FoodTooltip },
  };

  return (
    <Stack spacing={1} sx={{ width: "100%" }}>
      <div className="overflow-visible rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
        <ScatterChart {...params} />
      </div>
    </Stack>
  );
}

function FoodTooltip() {
  return (
    <ChartsTooltipContainer
      anchor="node"
      position="top"
      trigger="item"
    >
      <FoodTooltipContent />
    </ChartsTooltipContainer>
  );
}

function FoodTooltipContent() {
  const item = useItemTooltip<"scatter">();
  if (!item) return null;

  const seriesId = item.identifier.seriesId as Bucket;
  const idx = item.identifier.dataIndex;
  const point = POINT_LOOKUP.get(seriesId)?.[idx];
  if (!point) return null;

  const stars = Math.round(point.avgRating);

  return (
    <Paper sx={{ p: 1.5, minWidth: 200 }} elevation={4}>
      <Typography variant="subtitle2" sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <span>{point.name}</span>
        <span style={{ color: COLORS[point.bucket] }}>
          {LABELS[point.bucket]}
        </span>
      </Typography>
      <Divider sx={{ my: 1 }} />
      <Typography variant="body2">
        Average{" "}
        <Typography component="span" variant="body2" sx={{ color: "#f59e0b" }}>
          {point.ratingCount > 0 ? "★".repeat(Math.max(1, stars)) : ""}
        </Typography>{" "}
        {point.ratingCount > 0 ? `${point.avgRating.toFixed(2)} / 5` : "no ratings"}
      </Typography>
      <Typography variant="body2">
        Submitted {point.ratingCount}{" "}
        {point.ratingCount === 1 ? "time" : "times"}
      </Typography>
    </Paper>
  );
}
