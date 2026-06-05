import { Schema, model, Document } from "mongoose";

export type SleepStage = "inBed" | "asleepUnspecified" | "awake" | "asleepDeep" | "asleepCore" | "asleepREM";

export interface ISleep extends Document {
  userId: string;
  stage: SleepStage;
  startDate: Date;
  endDate: Date;
  durationSeconds: number;
  source: string;
}

const SleepSchema = new Schema<ISleep>(
  {
    userId: { type: String, required: true, index: true },
    stage: { type: String, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    durationSeconds: { type: Number, required: true },
    source: { type: String, default: "Apple Health" },
  },
  { timestamps: true }
);

SleepSchema.index({ userId: 1, startDate: -1 });

export const Sleep = model<ISleep>("Sleep", SleepSchema);
