import { Vital, VitalType } from "../../db/models/Vitals.js";

const META: Record<VitalType, { label: string; unit: string; normalRange: string }> = {
  heart_rate:              { label: "Heart Rate",               unit: "bpm",   normalRange: "60–100 bpm" },
  resting_heart_rate:      { label: "Resting Heart Rate",       unit: "bpm",   normalRange: "40–80 bpm (lower is generally better for fit individuals)" },
  hrv:                     { label: "Heart Rate Variability",   unit: "ms",    normalRange: "Highly individual — higher is generally better; compare to personal baseline" },
  blood_oxygen:            { label: "Blood Oxygen (SpO2)",      unit: "%",     normalRange: "95–100%" },
  blood_pressure_systolic: { label: "Blood Pressure Systolic",  unit: "mmHg",  normalRange: "< 120 mmHg" },
  blood_pressure_diastolic:{ label: "Blood Pressure Diastolic", unit: "mmHg",  normalRange: "< 80 mmHg" },
};

function classify(type: VitalType, value: number): string {
  switch (type) {
    case "heart_rate":
      if (value < 60) return "low — may indicate bradycardia if symptomatic";
      if (value > 100) return "elevated — tachycardia";
      return "normal";
    case "resting_heart_rate":
      if (value < 40) return "very low — consult a doctor if not a trained athlete";
      if (value <= 60) return "excellent";
      if (value <= 80) return "normal";
      return "above average — may benefit from more aerobic exercise";
    case "hrv":
      return "compare to personal trend — no universal normal range";
    case "blood_oxygen":
      if (value < 90) return "critically low — seek medical attention";
      if (value < 95) return "below normal — consider consulting a doctor";
      return "normal";
    case "blood_pressure_systolic":
      if (value < 90)  return "low blood pressure";
      if (value < 120) return "normal";
      if (value < 130) return "elevated";
      if (value < 140) return "high — stage 1 hypertension";
      return "high — stage 2 hypertension";
    case "blood_pressure_diastolic":
      if (value < 60)  return "low blood pressure";
      if (value < 80)  return "normal";
      if (value < 90)  return "elevated";
      return "high — stage 2 hypertension";
  }
}

export async function getLatestVitals(args: { userId: string }) {
  const types: VitalType[] = [
    "heart_rate", "resting_heart_rate", "hrv", "blood_oxygen",
    "blood_pressure_systolic", "blood_pressure_diastolic",
  ];

  const readings = await Promise.all(
    types.map((type) =>
      Vital.findOne({ userId: args.userId, type })
        .sort({ startDate: -1 })
        .select("type value unit startDate source")
        .lean()
    )
  );

  const result: Record<string, unknown> = {};
  const bpReadings: { systolic?: number; diastolic?: number; measuredAt?: Date } = {};

  for (const r of readings) {
    if (!r) continue;
    const meta = META[r.type as VitalType];
    const entry = {
      label: meta.label,
      value: r.value,
      unit: meta.unit,
      status: classify(r.type as VitalType, r.value),
      normalRange: meta.normalRange,
      measuredAt: r.startDate,
      source: r.source,
    };

    if (r.type === "blood_pressure_systolic") {
      bpReadings.systolic = r.value;
      bpReadings.measuredAt = r.startDate;
      result.blood_pressure_systolic = entry;
    } else if (r.type === "blood_pressure_diastolic") {
      bpReadings.diastolic = r.value;
      result.blood_pressure_diastolic = entry;
    } else {
      result[r.type] = entry;
    }
  }

  // Combine blood pressure into a joint reading when both sides are present
  if (bpReadings.systolic !== undefined && bpReadings.diastolic !== undefined) {
    result.blood_pressure = {
      label: "Blood Pressure",
      value: `${bpReadings.systolic}/${bpReadings.diastolic}`,
      unit: "mmHg",
      systolicStatus: classify("blood_pressure_systolic", bpReadings.systolic),
      diastolicStatus: classify("blood_pressure_diastolic", bpReadings.diastolic),
      normalRange: "< 120/80 mmHg",
      measuredAt: bpReadings.measuredAt,
    };
  }

  return result;
}

export async function getVitals(args: {
  userId: string;
  type?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const filter: Record<string, unknown> = { userId: args.userId };
  if (args.type) filter.type = args.type;
  if (args.from || args.to) {
    filter.startDate = {};
    if (args.from) (filter.startDate as Record<string, Date>).$gte = new Date(args.from);
    if (args.to)   (filter.startDate as Record<string, Date>).$lte = new Date(args.to);
  }

  const records = await Vital.find(filter)
    .sort({ startDate: -1 })
    .limit(args.limit ?? 100)
    .select("type value unit startDate source")
    .lean();

  return records.map((r) => {
    const meta = META[r.type as VitalType];
    return {
      type: r.type,
      label: meta?.label ?? r.type,
      value: r.value,
      unit: r.unit,
      status: classify(r.type as VitalType, r.value),
      normalRange: meta?.normalRange,
      measuredAt: r.startDate,
      source: r.source,
    };
  });
}
