import { getHealthCoachingSnapshot } from "./coaching.js";
import { getLatestVitals } from "./vitals.js";
import { getSleepSummary } from "./sleep.js";
import { getWorkouts } from "./workouts.js";
import { getActivity } from "./activity.js";

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function generateHealthReport(args: {
  userId: string;
  date?: string;
}) {
  const anchor = args.date ? new Date(args.date) : new Date();
  const anchorStr = anchor.toISOString().slice(0, 10);

  // Fetch everything in parallel — coaching snapshot is the backbone,
  // the rest fills in sections the snapshot doesn't cover in full.
  const [snapshot, allVitals, sleep7d, workouts30d, activity30d] = await Promise.all([
    getHealthCoachingSnapshot({ userId: args.userId, date: args.date }),
    getLatestVitals({ userId: args.userId }),
    getSleepSummary({ userId: args.userId, days: 7 }),
    getWorkouts({ userId: args.userId, from: new Date(anchor.getTime() - 30 * 86_400_000).toISOString(), limit: 50 }),
    getActivity({ userId: args.userId, days: 30 }),
  ]);

  // ── Cardiovascular section ───────────────────────────────────────────────
  const cardio = {
    heartRate:          allVitals.heart_rate          ?? null,
    restingHeartRate:   allVitals.resting_heart_rate  ?? null,
    hrv:                allVitals.hrv                 ?? null,
    bloodOxygen:        allVitals.blood_oxygen        ?? null,
    bloodPressure:      allVitals.blood_pressure      ?? null,
    walkingHeartRate:   allVitals.walking_heart_rate_average ?? null,
    vo2Max:             allVitals.vo2_max             ?? null,
    hrvVsBaseline:      snapshot.recovery.hrv,
    rhrVsBaseline:      snapshot.recovery.restingHeartRate,
  };

  // ── Sleep section ────────────────────────────────────────────────────────
  const sleepNights = sleep7d.nights.filter(n => n.totalSleepHours > 0.5);
  const sleepSection = {
    lastNight:          snapshot.lastNightSleep,
    consistency:        snapshot.sleepConsistency,
    trend7d: {
      summary:          sleep7d.summary,
      nights:           sleepNights,
    },
    baseline30dAvg: snapshot.lastNightSleep?.vsBaseline30d ?? null,
  };

  // ── Fitness & training section ───────────────────────────────────────────
  const workoutTypes = Object.entries(workouts30d.summary.byType)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([type, stats]) => ({ type, ...stats }));

  const avg30dSteps = activity30d.averages.stepsPerDay;
  const stepTrend = activity30d.dailyLog.slice(0, 7).map(d => ({ date: d.date, steps: d.steps }));

  const fitness = {
    vo2Max:               allVitals.vo2_max ?? null,
    workouts30d: {
      total:              workouts30d.summary.totalWorkouts,
      totalKcal:          workouts30d.summary.totalKcal,
      totalDistanceKm:    workouts30d.summary.totalDistanceKm,
      avgDuration:        workouts30d.summary.avgDuration,
      byType:             workoutTypes,
    },
    trainingLoad:         snapshot.trainingLoad,
    activityAvg30d: {
      stepsPerDay:        avg30dSteps,
      activeKcalPerDay:   activity30d.averages.activeKcalPerDay,
      exerciseMinPerDay:  activity30d.averages.exerciseMinutesPerDay,
      stepGoalHitDays:    activity30d.summary.stepGoalHitDays,
    },
    stepTrendLast7d:      stepTrend,
    activityToday:        snapshot.activityToday,
  };

  // ── Recovery section ─────────────────────────────────────────────────────
  const recovery = {
    readinessScore:       snapshot.readiness.score,
    readinessLabel:       snapshot.readiness.label,
    exerciseRecommendation: snapshot.readiness.exerciseRecommendation,
    signals:              snapshot.readiness.signals,
    recovery:             snapshot.recovery,
  };

  // ── Data completeness ────────────────────────────────────────────────────
  const available = {
    hrv:              !!allVitals.hrv,
    restingHR:        !!allVitals.resting_heart_rate,
    bloodPressure:    !!allVitals.blood_pressure,
    bloodOxygen:      !!allVitals.blood_oxygen,
    walkingHR:        !!allVitals.walking_heart_rate_average,
    vo2Max:           !!allVitals.vo2_max,
    sleepLastNight:   !!snapshot.lastNightSleep,
    workoutsTracked:  workouts30d.summary.totalWorkouts > 0,
    activityTracked:  activity30d.range.daysTracked > 0,
  };

  const missingData = Object.entries(available)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  // ── Report ───────────────────────────────────────────────────────────────
  return {
    reportDate: anchorStr,
    dataCompleteness: {
      available,
      missing: missingData,
      completenessNote: missingData.length === 0
        ? "All health metrics available — full report possible."
        : `Missing data for: ${missingData.join(", ")}. Report sections for these will be limited.`,
    },

    sections: {
      readinessAndRecovery: recovery,
      cardiovascular:       cardio,
      sleep:                sleepSection,
      fitnessAndActivity:   fitness,
    },

    reportInstructions: [
      "Generate a full health report with clearly labelled sections in this order:",
      "1. EXECUTIVE SUMMARY — 3–4 sentences: overall readiness score, standout positives, standout concerns. Lead with the most important finding.",
      "2. CARDIOVASCULAR HEALTH — cover HR, RHR vs baseline, HRV vs baseline, blood pressure status, SpO2, VO2 max fitness level, walking HR trend. Flag anything outside normal range.",
      "3. SLEEP — last night's quality (hours, efficiency, deep, REM vs targets), comparison to 30-day average, sleep schedule consistency, 7-day trend. State what was good and what was lacking.",
      "4. FITNESS & ACTIVITY — workout frequency and types over last 30 days, daily step average vs 10k goal, active calories, training load status (consecutive days, rest since last workout).",
      "5. RECOVERY STATUS — readiness score with explanation of every signal that drove it up or down. Be specific: cite actual numbers.",
      "6. RECOMMENDATIONS — 3–5 concrete, prioritised actions for today and this week. Ground each in a specific data point from this report.",
      "Always cite specific numbers (e.g. 'your HRV is 58 ms vs your 30-day average of 52 ms'). Never give generic advice not supported by the data.",
      "If a section has missing data, briefly note it and move on — do not pad with generic health education.",
      "Tone: direct, data-driven, like a sports medicine doctor reviewing your chart.",
    ],
  };
}
