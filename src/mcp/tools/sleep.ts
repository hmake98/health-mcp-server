import { Sleep } from "../../db/models/Sleep.js";

const toHours = (seconds: number) => Math.round(seconds / 360) / 10;

const round1 = (n: number) => Math.round(n * 10) / 10;

// Stages that represent actual sleep (not just time in bed)
const SLEEP_STAGES = new Set(["asleepDeep", "asleepREM", "asleepCore", "asleepUnspecified"]);

// Shift by 12 h so the grouping boundary falls at noon UTC instead of midnight UTC.
// For IST (UTC+5:30) users this puts the boundary at 5:30 pm IST — well outside any
// normal sleep window — so a continuous overnight session is never split across two dates.
// The returned date represents the evening the sleep session began (standard convention).
const sleepNightDate = (d: Date) =>
  new Date(d.getTime() - 12 * 3600000).toISOString().slice(0, 10);

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

  // Extend lookback by 12 h so that early-morning stages belonging to the
  // first night in range aren't cut off by the shifted boundary.
  const queryFrom = new Date(from.getTime() - 12 * 3600000);

  const records = await Sleep.find({
    userId: args.userId,
    startDate: { $gte: queryFrom, $lte: to },
  })
    .sort({ startDate: 1 })
    .select("stage startDate durationSeconds")
    .lean();

  // Group by sleep-night date. Keep inBed separate to avoid double-counting.
  const byDate: Record<string, {
    stages: Record<string, number>;
    inBedSeconds: number;
  }> = {};

  for (const r of records) {
    const day = sleepNightDate(r.startDate);
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
