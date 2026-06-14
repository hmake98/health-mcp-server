import { Vital } from "../../db/models/Vitals.js";
import { Sleep } from "../../db/models/Sleep.js";
import { Workout } from "../../db/models/Workout.js";
import { Activity } from "../../db/models/Activity.js";

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const stdDev = (arr: number[], m: number) =>
  arr.length > 1 ? Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length) : 0;

const SLEEP_STAGES = new Set(["asleepDeep", "asleepREM", "asleepCore", "asleepUnspecified"]);

// Shift boundary to noon UTC so IST overnight sessions never split across two dates.
const sleepNightDate = (d: Date) =>
  new Date(d.getTime() - 12 * 3600_000).toISOString().slice(0, 10);

export async function getHealthCoachingSnapshot(args: {
  userId: string;
  date?: string;
}) {
  const anchor = args.date ? new Date(args.date) : new Date();
  const anchorStr = anchor.toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(anchor.getTime() - n * 86_400_000);

  // ── Parallel data fetches ────────────────────────────────────────────────
  const [
    recentVitals,       // HRV + RHR last 30 days
    latestHR,           // latest heart_rate
    latestSpO2,         // latest blood_oxygen
    latestWalkingHR,    // latest walking_heart_rate_average
    latestVO2Max,       // latest vo2_max (Apple Cardio Fitness)
    sleepRaw,           // sleep segments last 33 days (covers baseline + recent)
    workouts14d,        // workouts last 14 days
    activity7d,         // activity last 7 days
  ] = await Promise.all([
    Vital.find({
      userId: args.userId,
      type: { $in: ["hrv", "resting_heart_rate"] },
      startDate: { $gte: daysAgo(30) },
    }).sort({ startDate: 1 }).select("type value startDate").lean(),

    Vital.findOne({ userId: args.userId, type: "heart_rate" })
      .sort({ startDate: -1 }).select("value startDate").lean(),

    Vital.findOne({ userId: args.userId, type: "blood_oxygen" })
      .sort({ startDate: -1 }).select("value startDate").lean(),

    Vital.findOne({ userId: args.userId, type: "walking_heart_rate_average" })
      .sort({ startDate: -1 }).select("value startDate").lean(),

    Vital.findOne({ userId: args.userId, type: "vo2_max" })
      .sort({ startDate: -1 }).select("value startDate").lean(),

    Sleep.find({
      userId: args.userId,
      startDate: { $gte: daysAgo(33 + 1), $lte: anchor },
    }).sort({ startDate: 1 }).select("stage startDate durationSeconds").lean(),

    Workout.find({
      userId: args.userId,
      startDate: { $gte: daysAgo(14) },
    }).sort({ startDate: -1 })
      .select("workoutType startDate durationSeconds totalEnergyBurnedKcal averageHeartRate")
      .lean(),

    Activity.find({
      userId: args.userId,
      date: { $gte: daysAgo(7), $lte: anchor },
    }).sort({ date: -1 })
      .select("date stepCount activeEnergyKcal exerciseMinutes")
      .lean(),
  ]);

  // ── HRV & RHR baselines ──────────────────────────────────────────────────
  const hrvSeries = recentVitals.filter(v => v.type === "hrv");
  const rhrSeries = recentVitals.filter(v => v.type === "resting_heart_rate");

  const todayHRV = [...hrvSeries].reverse().find(v =>
    v.startDate.toISOString().slice(0, 10) <= anchorStr
  ) ?? null;
  const todayRHR = [...rhrSeries].reverse().find(v =>
    v.startDate.toISOString().slice(0, 10) <= anchorStr
  ) ?? null;

  // Exclude today's reading from baseline so we're always comparing to history
  const hrvBaseline = hrvSeries.filter(v => v.startDate.toISOString().slice(0, 10) < anchorStr).map(v => v.value);
  const rhrBaseline = rhrSeries.filter(v => v.startDate.toISOString().slice(0, 10) < anchorStr).map(v => v.value);

  const hrvMean = mean(hrvBaseline);
  const rhrMean = mean(rhrBaseline);
  const hrvStd  = hrvMean != null ? stdDev(hrvBaseline, hrvMean) : 0;
  const rhrStd  = rhrMean != null ? stdDev(rhrBaseline, rhrMean) : 0;

  // ── Sleep: group by night, last 30 nights ───────────────────────────────
  const byNight: Record<string, { stages: Record<string, number>; inBedSec: number }> = {};
  for (const r of sleepRaw) {
    const night = sleepNightDate(r.startDate);
    if (!byNight[night]) byNight[night] = { stages: {}, inBedSec: 0 };
    if (r.stage === "inBed") {
      byNight[night].inBedSec += r.durationSeconds;
    } else {
      byNight[night].stages[r.stage] = (byNight[night].stages[r.stage] ?? 0) + r.durationSeconds;
    }
  }

  const computeNight = (night: string, data: typeof byNight[string]) => {
    const sleepSec = Object.entries(data.stages)
      .filter(([s]) => SLEEP_STAGES.has(s))
      .reduce((s, [, v]) => s + v, 0);
    const awakeSec = data.stages.awake ?? 0;
    const inBedSec = data.inBedSec > 0 ? data.inBedSec : sleepSec + awakeSec;
    const efficiency = inBedSec > 0 ? Math.round((sleepSec / inBedSec) * 100) : null;
    return {
      date: night,
      totalSleepHours: round1(sleepSec / 3600),
      timeInBedHours: round1(inBedSec / 3600),
      efficiencyPct: efficiency,
      deepHours: round1((data.stages.asleepDeep ?? 0) / 3600),
      remHours:  round1((data.stages.asleepREM ?? 0) / 3600),
      coreHours: round1((data.stages.asleepCore ?? 0) / 3600),
      awakeHours: round1(awakeSec / 3600),
    };
  };

  const allNights = Object.entries(byNight)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([night, data]) => computeNight(night, data));

  // Last night = most recent night with meaningful sleep
  const lastNight = allNights.find(n => n.totalSleepHours > 0.5) ?? null;

  // ── Sleep consistency (bedtime variance) ────────────────────────────────
  // Express each night's sleep onset as minutes past noon UTC (same 12h-shift anchor
  // used for grouping). This keeps bedtimes like 10 pm (600 min) and 1 am (780 min)
  // on the same numeric scale without wrapping around midnight.
  const sleepOnsetByNight: Record<string, number> = {};
  for (const r of sleepRaw) {
    if (r.stage === "inBed" || r.stage === "awake") continue;
    const night = sleepNightDate(r.startDate);
    // Minutes past noon UTC
    const minsFromNoon = ((r.startDate.getUTCHours() * 60 + r.startDate.getUTCMinutes()) - 12 * 60 + 1440) % 1440;
    if (sleepOnsetByNight[night] === undefined || minsFromNoon < sleepOnsetByNight[night]) {
      sleepOnsetByNight[night] = minsFromNoon;
    }
  }

  const onsetMinutes = Object.entries(sleepOnsetByNight)
    .filter(([night]) => lastNight && night <= lastNight.date)
    .map(([, mins]) => mins);

  const onsetMean = mean(onsetMinutes);
  const onsetStd  = onsetMean != null && onsetMinutes.length > 1
    ? stdDev(onsetMinutes, onsetMean)
    : null;

  // Convert mean onset back to a readable local time string (IST = UTC+5:30 = +330 min)
  const minsToTimeStr = (minsFromNoon: number) => {
    const totalMins = (minsFromNoon + 12 * 60) % (24 * 60); // back to minutes-since-midnight UTC
    const localMins = (totalMins + 330) % (24 * 60); // UTC+5:30
    const h = Math.floor(localMins / 60);
    const m = localMins % 60;
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  };

  const sleepConsistency = onsetMean != null && onsetMinutes.length >= 5
    ? {
        nightsAnalyzed: onsetMinutes.length,
        avgBedtime: minsToTimeStr(onsetMean),
        bedtimeStdDevMinutes: onsetStd !== null ? Math.round(onsetStd) : null,
        consistencyRating:
          onsetStd === null ? "insufficient_data" :
          onsetStd <= 15  ? "excellent — very regular sleep schedule" :
          onsetStd <= 30  ? "good — mild variation" :
          onsetStd <= 45  ? "moderate — noticeable variation; consider a fixed bedtime" :
                            "poor — highly irregular schedule; circadian rhythm likely disrupted",
      }
    : { nightsAnalyzed: onsetMinutes.length, note: "Need 5+ nights of data for consistency analysis" };

  // 30-day sleep averages (exclude last night to keep baseline clean)
  const baselineNights = allNights.filter(n => lastNight && n.date < lastNight.date);
  const sleepAvg30d = baselineNights.length
    ? {
        totalSleepHours: round1(mean(baselineNights.map(n => n.totalSleepHours))!),
        deepHours:  round1(mean(baselineNights.map(n => n.deepHours))!),
        remHours:   round1(mean(baselineNights.map(n => n.remHours))!),
        efficiencyPct: Math.round(mean(baselineNights.map(n => n.efficiencyPct ?? 0))!),
        nightsTracked: baselineNights.length,
      }
    : null;

  // ── Training load ────────────────────────────────────────────────────────
  const workoutToDay = (w: typeof workouts14d[0]) =>
    w.startDate.toISOString().slice(0, 10);

  const workouts7d = workouts14d.filter(
    w => w.startDate >= daysAgo(7)
  );
  const workouts3d = workouts14d.filter(
    w => w.startDate >= daysAgo(3)
  );

  const lastWorkout = workouts14d[0] ?? null;
  const daysSinceLast = lastWorkout
    ? Math.floor((anchor.getTime() - lastWorkout.startDate.getTime()) / 86_400_000)
    : null;

  // Consecutive days with at least one workout ending at anchor
  const workoutDaySet = new Set(workouts14d.map(workoutToDay));
  let consecutiveDays = 0;
  for (let i = 0; i < 14; i++) {
    const d = daysAgo(i).toISOString().slice(0, 10);
    if (workoutDaySet.has(d)) consecutiveDays++;
    else break;
  }

  // ── Readiness score ──────────────────────────────────────────────────────
  // Starts at 70 (neutral). Signals push it up or down.
  let score = 70;
  const signals: string[] = [];

  // HRV signal (weight: ±20)
  if (todayHRV && hrvMean != null && hrvBaseline.length >= 5) {
    const z = hrvStd > 0 ? (todayHRV.value - hrvMean) / hrvStd : 0;
    if (z >= 1.0)        { score += 20; signals.push(`HRV ${todayHRV.value} ms — well above your 30-day baseline of ${round1(hrvMean)} ms (+${round1(z)} SD): excellent recovery signal`); }
    else if (z >= 0.25)  { score += 10; signals.push(`HRV ${todayHRV.value} ms — slightly above baseline (${round1(hrvMean)} ms): good recovery`); }
    else if (z >= -0.25) { score +=  3; signals.push(`HRV ${todayHRV.value} ms — at your baseline (${round1(hrvMean)} ms): normal recovery`); }
    else if (z >= -1.0)  { score -= 10; signals.push(`HRV ${todayHRV.value} ms — below your baseline (${round1(hrvMean)} ms, ${round1(Math.abs(z))} SD low): body may still be recovering`); }
    else                 { score -= 20; signals.push(`HRV ${todayHRV.value} ms — significantly suppressed vs baseline (${round1(hrvMean)} ms, ${round1(Math.abs(z))} SD low): clear fatigue or stress signal`); }
  } else if (todayHRV) {
    signals.push(`HRV ${todayHRV.value} ms (insufficient history for baseline comparison)`);
  } else {
    signals.push("No recent HRV reading — check Apple Watch wear during sleep");
  }

  // RHR signal (weight: ±15)
  if (todayRHR && rhrMean != null && rhrBaseline.length >= 5) {
    const diff = todayRHR.value - rhrMean;
    const z = rhrStd > 0 ? diff / rhrStd : 0;
    // Lower RHR = better recovery (inverse of HRV)
    if (z <= -1.5)       { score += 15; signals.push(`Resting HR ${todayRHR.value} bpm — notably lower than your norm (${round1(rhrMean)} bpm): very well rested`); }
    else if (z <= -0.5)  { score +=  7; signals.push(`Resting HR ${todayRHR.value} bpm — below your baseline (${round1(rhrMean)} bpm): good recovery indicator`); }
    else if (z <=  0.5)  { score +=  0; signals.push(`Resting HR ${todayRHR.value} bpm — within normal range (baseline ${round1(rhrMean)} bpm)`); }
    else if (z <=  1.5)  { score -=  8; signals.push(`Resting HR ${todayRHR.value} bpm — elevated vs your baseline (${round1(rhrMean)} bpm): possible accumulated fatigue or stress`); }
    else                 { score -= 15; signals.push(`Resting HR ${todayRHR.value} bpm — significantly elevated vs baseline (${round1(rhrMean)} bpm): consider rest — could indicate illness or overtraining`); }
  } else if (todayRHR) {
    signals.push(`Resting HR ${todayRHR.value} bpm (insufficient history for baseline comparison)`);
  }

  // Sleep signal (weight: ±20)
  if (lastNight) {
    const sleepH = lastNight.totalSleepHours;
    const eff = lastNight.efficiencyPct;
    const vsAvg = sleepAvg30d ? round1(sleepH - sleepAvg30d.totalSleepHours) : null;
    const deepOk = lastNight.deepHours >= 1.0;
    const remOk  = lastNight.remHours  >= 1.5;

    if (sleepH >= 7.5 && eff && eff >= 87) {
      score += 20;
      signals.push(`Excellent sleep: ${sleepH}h at ${eff}% efficiency${vsAvg !== null ? `, ${vsAvg >= 0 ? "+" : ""}${vsAvg}h vs your average` : ""}`);
    } else if (sleepH >= 6.5 && eff && eff >= 80) {
      score += 10;
      signals.push(`Adequate sleep: ${sleepH}h at ${eff}% efficiency${vsAvg !== null ? ` (avg: ${sleepAvg30d!.totalSleepHours}h)` : ""}`);
    } else if (sleepH < 5.5) {
      score -= 20;
      signals.push(`Very short sleep: only ${sleepH}h last night${sleepAvg30d ? ` (you normally get ${sleepAvg30d.totalSleepHours}h)` : ""} — recovery significantly compromised`);
    } else if (sleepH < 6.5) {
      score -= 10;
      signals.push(`Short sleep: ${sleepH}h — below the 7–9h target${vsAvg !== null ? `, ${vsAvg}h under your average` : ""}`);
    }

    if (eff && eff < 75) {
      score -= 10;
      signals.push(`Low sleep efficiency (${eff}%) — frequent waking or difficulty falling asleep; restorative value diminished`);
    }
    if (!deepOk) signals.push(`Light on deep sleep (${lastNight.deepHours}h) — targets 1–1.5h/night for physical recovery`);
    if (!remOk)  signals.push(`Light on REM sleep (${lastNight.remHours}h) — targets 1.5–2h/night for cognitive recovery`);
  } else {
    signals.push("No sleep data found for last night");
  }

  // Training load signal (weight: ±10)
  if (consecutiveDays >= 4) {
    score -= 10;
    signals.push(`${consecutiveDays} consecutive training days — accumulated fatigue risk; consider an easy or rest day`);
  } else if (consecutiveDays === 3) {
    score -= 5;
    signals.push(`3 consecutive training days — watch for fatigue accumulation`);
  }

  if (daysSinceLast !== null && daysSinceLast >= 3) {
    score += 5;
    signals.push(`${daysSinceLast} days since last workout — muscles well recovered`);
  }

  if (workouts3d.length === 0 && workouts7d.length > 0) {
    score += 5;
    signals.push("No workouts in the last 3 days — fresh for a training session");
  }

  // Sleep consistency signal (informational, no score impact — it's structural not acute)
  const bedtimeStd = "bedtimeStdDevMinutes" in sleepConsistency
    ? sleepConsistency.bedtimeStdDevMinutes
    : undefined;
  if (typeof bedtimeStd === "number") {
    if (bedtimeStd > 45) {
      signals.push(`Irregular sleep schedule (±${bedtimeStd} min bedtime variance) — inconsistent circadian rhythm can reduce sleep quality even when total hours look fine`);
    } else if (bedtimeStd > 30) {
      signals.push(`Moderate bedtime variation (±${bedtimeStd} min) — a more consistent schedule would improve sleep quality`);
    }
  }

  // Clamp 0–100
  score = Math.max(0, Math.min(100, Math.round(score)));

  const readinessLabel =
    score >= 85 ? "Peak — push hard if goals align" :
    score >= 70 ? "Good — quality training session appropriate" :
    score >= 55 ? "Moderate — steady/aerobic work; avoid max intensity" :
    score >= 40 ? "Low — light movement only (walk, stretch, zone 1)" :
                  "Very Low — rest and recover today";

  const exerciseRecommendation =
    score >= 85 ? "Green light for a high-intensity session, strength PR attempt, or long endurance effort." :
    score >= 70 ? "Good day for regular training. Stick to your planned session; no need to go easier, but don't chase extra volume." :
    score >= 55 ? "Moderate readiness. Zone 2 cardio, light weights, or skill work is ideal. Avoid going to failure." :
    score >= 40 ? "Sub-optimal day. A 20–30 min walk or yoga session keeps momentum without digging a deeper hole." :
                  "Rest day recommended. Sleep, hydration, and nutrition will return more readiness than any workout today.";

  // ── Activity today ───────────────────────────────────────────────────────
  const todayActivity = activity7d.find(a => a.date.toISOString().slice(0, 10) === anchorStr) ?? null;
  const avg7dSteps = activity7d.length
    ? Math.round(mean(activity7d.map(a => a.stepCount))!)
    : null;

  // ── Output ───────────────────────────────────────────────────────────────
  return {
    date: anchorStr,

    readiness: {
      score,
      outOf: 100,
      label: readinessLabel,
      exerciseRecommendation,
      signals,
    },

    recovery: {
      hrv: todayHRV
        ? {
            current: todayHRV.value,
            unit: "ms",
            measuredAt: todayHRV.startDate,
            baseline30dMean: hrvMean != null ? round1(hrvMean) : null,
            baseline30dStd:  hrvStd > 0 ? round1(hrvStd) : null,
            trend: hrvMean != null && hrvBaseline.length >= 5
              ? (todayHRV.value > hrvMean ? "above_baseline" : "below_baseline")
              : "insufficient_history",
            interpretation:
              "Higher HRV = better autonomic balance = more recovered. Compare current to your own baseline, not population norms.",
          }
        : null,

      restingHeartRate: todayRHR
        ? {
            current: todayRHR.value,
            unit: "bpm",
            measuredAt: todayRHR.startDate,
            baseline30dMean: rhrMean != null ? round1(rhrMean) : null,
            trend: rhrMean != null && rhrBaseline.length >= 5
              ? (todayRHR.value < rhrMean ? "below_baseline" : "above_baseline")
              : "insufficient_history",
            interpretation:
              "Lower resting HR than your norm = well recovered. Elevated = fatigue, illness, or stress.",
          }
        : null,

      bloodOxygen: latestSpO2
        ? { value: latestSpO2.value, unit: "%", measuredAt: latestSpO2.startDate }
        : null,

      heartRate: latestHR
        ? { value: latestHR.value, unit: "bpm", measuredAt: latestHR.startDate }
        : null,

      walkingHeartRate: latestWalkingHR
        ? {
            value: latestWalkingHR.value,
            unit: "bpm",
            measuredAt: latestWalkingHR.startDate,
            interpretation: "Lower walking HR for the same pace = better cardiovascular efficiency. Track the trend over weeks.",
          }
        : null,

      vo2Max: latestVO2Max
        ? {
            value: round1(latestVO2Max.value),
            unit: "mL/min/kg",
            measuredAt: latestVO2Max.startDate,
            fitnessLevel:
              latestVO2Max.value < 30 ? "poor" :
              latestVO2Max.value < 38 ? "below average" :
              latestVO2Max.value < 45 ? "average" :
              latestVO2Max.value < 52 ? "above average" :
              latestVO2Max.value < 60 ? "excellent" : "superior/elite",
            interpretation: "VO2 max is the strongest single predictor of long-term cardiovascular health. Improve it with zone 2 and interval training.",
          }
        : null,
    },

    sleepConsistency,

    lastNightSleep: lastNight
      ? {
          ...lastNight,
          vsBaseline30d: sleepAvg30d
            ? {
                avgTotalSleepHours: sleepAvg30d.totalSleepHours,
                avgDeepHours: sleepAvg30d.deepHours,
                avgRemHours:  sleepAvg30d.remHours,
                avgEfficiencyPct: sleepAvg30d.efficiencyPct,
                nightsTracked: sleepAvg30d.nightsTracked,
                deltaHours: round1(lastNight.totalSleepHours - sleepAvg30d.totalSleepHours),
              }
            : null,
          sleepQualityNotes: [
            lastNight.deepHours < 1.0 ? "Deep sleep below target (< 1h) — avoid alcohol, heavy meals late; keep consistent bedtime" : null,
            lastNight.remHours < 1.5  ? "REM sleep below target (< 1.5h) — sleep deprivation and alcohol suppress REM; prioritize consistent sleep schedule" : null,
            (lastNight.efficiencyPct ?? 100) < 80 ? "Sleep efficiency below 80% — large time awake in bed; consider sleep restriction or CBT-I techniques" : null,
          ].filter(Boolean),
        }
      : null,

    trainingLoad: {
      workoutsLast3Days: workouts3d.length,
      workoutsLast7Days: workouts7d.length,
      workoutsLast14Days: workouts14d.length,
      daysSinceLastWorkout: daysSinceLast,
      consecutiveTrainingDays: consecutiveDays,
      totalKcalLast7Days: Math.round(workouts7d.reduce((s, w) => s + w.totalEnergyBurnedKcal, 0)),
      recentWorkouts: workouts14d.slice(0, 7).map(w => ({
        type: w.workoutType,
        date: w.startDate.toISOString().slice(0, 10),
        durationMin: Math.round(w.durationSeconds / 60),
        kcal: Math.round(w.totalEnergyBurnedKcal),
        avgHR: w.averageHeartRate ?? null,
      })),
    },

    activityToday: todayActivity
      ? {
          steps: todayActivity.stepCount,
          activeKcal: Math.round(todayActivity.activeEnergyKcal),
          exerciseMinutes: todayActivity.exerciseMinutes,
          stepsVs7dAvg: avg7dSteps !== null ? todayActivity.stepCount - avg7dSteps : null,
        }
      : { note: "No activity data recorded yet for today" },

    avg7dActivity: avg7dSteps !== null
      ? {
          stepsPerDay: avg7dSteps,
          activeKcalPerDay: Math.round(mean(activity7d.map(a => a.activeEnergyKcal))!),
          exerciseMinutesPerDay: Math.round(mean(activity7d.map(a => a.exerciseMinutes))!),
        }
      : null,

    coachingInstructions: [
      "Use readiness.score as the primary signal. Below 50 = rest/easy only.",
      "HRV and RHR baselines require ~7+ days of data to be meaningful — flag this to the user if insufficient_history.",
      "Sleep stage targets: deep ≥ 1h, REM ≥ 1.5h, efficiency ≥ 85%, total ≥ 7h.",
      "Never recommend high-intensity exercise when score < 45 AND both HRV is suppressed AND sleep was < 6h.",
      "Ask the user how they feel subjectively — subjective fatigue overrides any score.",
      "When giving advice, cite specific numbers from this snapshot (e.g. 'your HRV is X vs your baseline of Y').",
      "For sleep questions: always give what was good, what was lacking, and one actionable tip.",
    ],
  };
}
