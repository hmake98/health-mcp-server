import { Schema, model, Document } from "mongoose";

export type VitalType =
  | "heart_rate"
  | "resting_heart_rate"
  | "hrv"
  | "blood_oxygen"
  | "blood_pressure_systolic"
  | "blood_pressure_diastolic";

export interface IVital extends Document {
  userId: string;
  type: VitalType;
  value: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  source: string;
}

const VitalSchema = new Schema<IVital>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    value: { type: Number, required: true },
    unit: { type: String, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    source: { type: String, default: "Apple Health" },
  },
  { timestamps: true }
);

VitalSchema.index({ userId: 1, type: 1, startDate: -1 });

export const Vital = model<IVital>("Vital", VitalSchema);
