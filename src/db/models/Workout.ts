import { Schema, model, Document } from "mongoose";

export interface IWorkout extends Document {
  userId: string;
  workoutType: string;
  startDate: Date;
  endDate: Date;
  durationSeconds: number;
  totalEnergyBurnedKcal: number;
  totalDistanceMeters: number;
  averageHeartRate?: number;
  source: string;
}

const WorkoutSchema = new Schema<IWorkout>(
  {
    userId: { type: String, required: true, index: true },
    workoutType: { type: String, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    durationSeconds: { type: Number, required: true },
    totalEnergyBurnedKcal: { type: Number, default: 0 },
    totalDistanceMeters: { type: Number, default: 0 },
    averageHeartRate: { type: Number },
    source: { type: String, default: "Apple Health" },
  },
  { timestamps: true }
);

// Unique constraint mirrors the upsert filter in the ingest route.
// Each workout has a unique start time per user.
WorkoutSchema.index({ userId: 1, startDate: 1 }, { unique: true });
WorkoutSchema.index({ userId: 1, startDate: -1 });

export const Workout = model<IWorkout>("Workout", WorkoutSchema);
