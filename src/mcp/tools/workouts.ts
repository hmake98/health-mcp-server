import { Workout } from "../../db/models/Workout.js";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function getWorkouts(args: {
  userId: string;
  workoutType?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const filter: Record<string, unknown> = { userId: args.userId };
  if (args.workoutType) {
    const escaped = args.workoutType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.workoutType = new RegExp(escaped, "i");
  }
  if (args.from || args.to) {
    filter.startDate = {};
    if (args.from) (filter.startDate as Record<string, Date>).$gte = new Date(args.from);
    if (args.to)   (filter.startDate as Record<string, Date>).$lte = new Date(args.to);
  }

  const records = await Workout.find(filter)
    .sort({ startDate: -1 })
    .limit(args.limit ?? 50)
    .select("workoutType startDate durationSeconds totalEnergyBurnedKcal totalDistanceMeters averageHeartRate source")
    .lean();

  const totalKcal = records.reduce((s, r) => s + r.totalEnergyBurnedKcal, 0);
  const totalDistanceKm = records.reduce((s, r) => s + r.totalDistanceMeters / 1000, 0);
  const totalDurationSec = records.reduce((s, r) => s + r.durationSeconds, 0);

  const byType = records.reduce<Record<string, { count: number; totalKcal: number; totalDistanceKm: number }>>(
    (acc, r) => {
      if (!acc[r.workoutType]) acc[r.workoutType] = { count: 0, totalKcal: 0, totalDistanceKm: 0 };
      acc[r.workoutType].count += 1;
      acc[r.workoutType].totalKcal += r.totalEnergyBurnedKcal;
      acc[r.workoutType].totalDistanceKm += r.totalDistanceMeters / 1000;
      return acc;
    },
    {}
  );

  // Round byType values for readability
  for (const type of Object.keys(byType)) {
    byType[type].totalKcal = Math.round(byType[type].totalKcal);
    byType[type].totalDistanceKm = round1(byType[type].totalDistanceKm);
  }

  return {
    summary: {
      totalWorkouts: records.length,
      totalKcal: Math.round(totalKcal),
      totalDistanceKm: round1(totalDistanceKm),
      totalDuration: formatDuration(totalDurationSec),
      avgKcalPerWorkout: records.length ? Math.round(totalKcal / records.length) : 0,
      avgDuration: records.length ? formatDuration(Math.round(totalDurationSec / records.length)) : "0 min",
      byType,
    },
    workouts: records.map((r) => ({
      type: r.workoutType,
      date: r.startDate.toISOString().slice(0, 10),
      startTime: r.startDate,
      duration: formatDuration(r.durationSeconds),
      kcal: Math.round(r.totalEnergyBurnedKcal),
      distanceKm: r.totalDistanceMeters > 0 ? round1(r.totalDistanceMeters / 1000) : null,
      avgHeartRate: r.averageHeartRate ?? null,
      source: r.source,
    })),
  };
}
