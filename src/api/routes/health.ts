import { Router, Request, Response } from "express";
import { z } from "zod";
import { Vital } from "../../db/models/Vitals.js";
import { Sleep } from "../../db/models/Sleep.js";
import { Workout } from "../../db/models/Workout.js";
import { Activity } from "../../db/models/Activity.js";

export const healthRouter = Router();

const source = z.string().max(128).optional();
const MAX_RECORDS = 500;

// ── Vitals ────────────────────────────────────────────────────────────────────

const VitalPayload = z.object({
  records: z.array(
    z.object({
      type: z.enum([
        "heart_rate",
        "resting_heart_rate",
        "hrv",
        "blood_oxygen",
        "blood_pressure_systolic",
        "blood_pressure_diastolic",
        "respiratory_rate",
        "walking_heart_rate_average",
      ]),
      value: z.number(),
      unit: z.string().max(32),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      source,
    })
  ).max(MAX_RECORDS),
});

healthRouter.post("/vitals", async (req: Request, res: Response) => {
  const parsed = VitalPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const userId = req.user!.id;
  const ops = parsed.data.records.map((r) => ({
    updateOne: {
      // Deduplicate by (userId, type, startDate) — same reading re-uploaded is a no-op
      filter: { userId, type: r.type, startDate: new Date(r.startDate) },
      update: {
        $set: {
          ...r,
          userId,
          startDate: new Date(r.startDate),
          endDate: new Date(r.endDate),
        },
      },
      upsert: true,
    },
  }));
  try {
    const result = await Vital.bulkWrite(ops, { ordered: false });
    res.json({ inserted: result.upsertedCount + result.modifiedCount });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

// ── Sleep ─────────────────────────────────────────────────────────────────────

const SleepPayload = z.object({
  records: z.array(
    z.object({
      stage: z.enum([
        "inBed",
        "asleepUnspecified",
        "awake",
        "asleepDeep",
        "asleepCore",
        "asleepREM",
      ]),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      durationSeconds: z.number(),
      source,
    })
  ).max(MAX_RECORDS),
});

healthRouter.post("/sleep", async (req: Request, res: Response) => {
  const parsed = SleepPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const userId = req.user!.id;
  const ops = parsed.data.records.map((r) => ({
    updateOne: {
      // Deduplicate by (userId, stage, startDate) — same sleep segment re-uploaded is a no-op
      filter: { userId, stage: r.stage, startDate: new Date(r.startDate) },
      update: {
        $set: {
          ...r,
          userId,
          startDate: new Date(r.startDate),
          endDate: new Date(r.endDate),
        },
      },
      upsert: true,
    },
  }));
  try {
    const result = await Sleep.bulkWrite(ops, { ordered: false });
    res.json({ inserted: result.upsertedCount + result.modifiedCount });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

// ── Workouts ──────────────────────────────────────────────────────────────────

const WorkoutPayload = z.object({
  records: z.array(
    z.object({
      workoutType: z.string().max(64),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      durationSeconds: z.number(),
      totalEnergyBurnedKcal: z.number().optional().default(0),
      totalDistanceMeters: z.number().optional().default(0),
      averageHeartRate: z.number().optional(),
      source,
    })
  ).max(MAX_RECORDS),
});

healthRouter.post("/workouts", async (req: Request, res: Response) => {
  const parsed = WorkoutPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const userId = req.user!.id;
  const ops = parsed.data.records.map((r) => ({
    updateOne: {
      // Deduplicate by (userId, startDate) — each workout has a unique start time
      filter: { userId, startDate: new Date(r.startDate) },
      update: {
        $set: {
          ...r,
          userId,
          startDate: new Date(r.startDate),
          endDate: new Date(r.endDate),
        },
      },
      upsert: true,
    },
  }));
  try {
    const result = await Workout.bulkWrite(ops, { ordered: false });
    res.json({ inserted: result.upsertedCount + result.modifiedCount });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

// ── Activity ──────────────────────────────────────────────────────────────────

function toMidnightUTC(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const ActivityPayload = z.object({
  records: z.array(
    z.object({
      date: z.string().datetime(),
      stepCount: z.number().optional().default(0),
      distanceMeters: z.number().optional().default(0),
      activeEnergyKcal: z.number().optional().default(0),
      exerciseMinutes: z.number().optional().default(0),
      flightsClimbed: z.number().optional().default(0),
      source,
    })
  ).max(MAX_RECORDS),
});

healthRouter.post("/activity", async (req: Request, res: Response) => {
  const parsed = ActivityPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const userId = req.user!.id;
  const ops = parsed.data.records.map((r) => ({
    updateOne: {
      filter: { userId, date: toMidnightUTC(r.date) },
      update: { $set: { ...r, userId, date: toMidnightUTC(r.date) } },
      upsert: true,
    },
  }));
  try {
    await Activity.bulkWrite(ops);
  } catch {
    res.status(500).json({ error: "Database error" });
    return;
  }
  res.json({ upserted: ops.length });
});

// ── Clear all health data for user ────────────────────────────────────────────

healthRouter.delete("/all", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  await Promise.all([
    Vital.deleteMany({ userId }),
    Sleep.deleteMany({ userId }),
    Workout.deleteMany({ userId }),
    Activity.deleteMany({ userId }),
  ]);
  res.json({ ok: true });
});
