import { Activity } from "../../db/models/Activity.js";

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function getActivity(args: {
  userId: string;
  from?: string;
  to?: string;
  days?: number;
}) {
  const from = args.from
    ? new Date(args.from)
    : new Date(Date.now() - (args.days ?? 7) * 86400000);
  const to = args.to ? new Date(args.to) : new Date();

  const records = await Activity.find({
    userId: args.userId,
    date: { $gte: from, $lte: to },
  })
    .sort({ date: -1 })
    .select("date stepCount distanceMeters activeEnergyKcal exerciseMinutes flightsClimbed")
    .lean();

  const totals = records.reduce(
    (acc, r) => ({
      steps: acc.steps + r.stepCount,
      distanceKm: acc.distanceKm + r.distanceMeters / 1000,
      activeKcal: acc.activeKcal + r.activeEnergyKcal,
      exerciseMinutes: acc.exerciseMinutes + r.exerciseMinutes,
      flightsClimbed: acc.flightsClimbed + r.flightsClimbed,
    }),
    { steps: 0, distanceKm: 0, activeKcal: 0, exerciseMinutes: 0, flightsClimbed: 0 }
  );

  const n = records.length || 1;
  const averages = {
    stepsPerDay: Math.round(totals.steps / n),
    distanceKmPerDay: round1(totals.distanceKm / n),
    activeKcalPerDay: Math.round(totals.activeKcal / n),
    exerciseMinutesPerDay: Math.round(totals.exerciseMinutes / n),
  };

  // Step goal context (10,000 steps is the common benchmark)
  const stepGoal = 10_000;
  const goalHitDays = records.filter((r) => r.stepCount >= stepGoal).length;

  return {
    range: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      daysTracked: records.length,
    },
    summary: {
      totalSteps: totals.steps,
      totalDistanceKm: round1(totals.distanceKm),
      totalActiveKcal: Math.round(totals.activeKcal),
      totalExerciseMinutes: totals.exerciseMinutes,
      totalFlightsClimbed: totals.flightsClimbed,
      stepGoalHitDays: `${goalHitDays}/${records.length} days hit 10,000 step goal`,
    },
    averages,
    dailyLog: records.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      steps: r.stepCount,
      distanceKm: round1(r.distanceMeters / 1000),
      activeKcal: Math.round(r.activeEnergyKcal),
      exerciseMinutes: r.exerciseMinutes,
      flightsClimbed: r.flightsClimbed,
      metStepGoal: r.stepCount >= stepGoal,
    })),
  };
}
