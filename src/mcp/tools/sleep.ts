import { Sleep } from "../../db/models/Sleep.js";

const toHours = (seconds: number) => Math.round(seconds / 360) / 10;

const round1 = (n: number) => Math.round(n * 10) / 10;

// Stages that represent actual sleep (not just time in bed)
const SLEEP_STAGES = new Set(["asleepDeep", "asleepREM", "asleepCore", "asleepUnspecified"]);

export async function getSleepSummary(args: {
  userId: string;
  from?: string;
  to?: string;
  days?: number;
}) {
  const from = args.from
    ? new Date(args.from)
    : new Date(Date.now() - (args.days ?? 7) * 86400000);
  const to = args.to ? new Date(args.to) : new Date();

  const records = await Sleep.find({
    userId: args.userId,
    startDate: { $gte: from, $lte: to },
  })
    .sort({ startDate: 1 })
    .select("stage startDate durationSeconds")
    .lean();

  // Group by calendar date. Keep inBed separate to avoid double-counting.
  const byDate: Record<string, {
    stages: Record<string, number>;
    inBedSeconds: number;
  }> = {};

  for (const r of records) {
    const day = r.startDate.toISOString().slice(0, 10);
    if (!byDate[day]) byDate[day] = { stages: {}, inBedSeconds: 0 };

    if (r.stage === "inBed") {
      byDate[day].inBedSeconds += r.durationSeconds;
    } else {
      byDate[day].stages[r.stage] = (byDate[day].stages[r.stage] ?? 0) + r.durationSeconds;
    }
  }

  const nights = Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data]) => {
      const sleepSeconds = Object.entries(data.stages)
        .filter(([stage]) => SLEEP_STAGES.has(stage))
        .reduce((s, [, v]) => s + v, 0);

      const awakeSeconds = data.stages.awake ?? 0;

      // Use explicit inBed time if recorded; otherwise estimate from sleep + awake
      const inBedSeconds = data.inBedSeconds > 0
        ? data.inBedSeconds
        : sleepSeconds + awakeSeconds;

      const efficiencyPct = inBedSeconds > 0
        ? Math.round((sleepSeconds / inBedSeconds) * 100)
        : null;

      return {
        date,
        totalSleepHours: toHours(sleepSeconds),
        timeInBedHours: toHours(inBedSeconds),
        sleepEfficiencyPct: efficiencyPct,
        stages: {
          deepHours: toHours(data.stages.asleepDeep ?? 0),
          remHours:  toHours(data.stages.asleepREM ?? 0),
          coreHours: toHours(data.stages.asleepCore ?? 0),
          awakeHours: toHours(awakeSeconds),
        },
        note: efficiencyPct !== null && efficiencyPct < 85
          ? "Sleep efficiency below 85% — frequent waking or trouble falling asleep"
          : null,
      };
    });

  // Overall averages (only nights with data)
  const avg = (fn: (n: typeof nights[0]) => number) => {
    const vals = nights.map(fn).filter((v) => v > 0);
    return vals.length ? round1(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  };

  return {
    range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    summary: {
      nightsTracked: nights.length,
      avgTotalSleepHours: avg((n) => n.totalSleepHours),
      avgDeepHours:  avg((n) => n.stages.deepHours),
      avgREMHours:   avg((n) => n.stages.remHours),
      avgCoreHours:  avg((n) => n.stages.coreHours),
      avgSleepEfficiencyPct: nights.length
        ? Math.round(nights.reduce((s, n) => s + (n.sleepEfficiencyPct ?? 0), 0) / nights.length)
        : null,
    },
    nights,
  };
}
