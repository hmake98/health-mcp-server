import { Schema, model, Document } from "mongoose";

export interface IActivity extends Document {
  userId: string;
  date: Date;
  stepCount: number;
  distanceMeters: number;
  activeEnergyKcal: number;
  exerciseMinutes: number;
  flightsClimbed: number;
  source: string;
}

const ActivitySchema = new Schema<IActivity>(
  {
    userId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    stepCount: { type: Number, default: 0 },
    distanceMeters: { type: Number, default: 0 },
    activeEnergyKcal: { type: Number, default: 0 },
    exerciseMinutes: { type: Number, default: 0 },
    flightsClimbed: { type: Number, default: 0 },
    source: { type: String, default: "Apple Health" },
  },
  { timestamps: true }
);

// one record per user per day — upsert on (userId, date)
ActivitySchema.index({ userId: 1, date: 1 }, { unique: true });

export const Activity = model<IActivity>("Activity", ActivitySchema);
