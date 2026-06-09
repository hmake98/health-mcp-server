import { Schema, model, Document } from "mongoose";

export interface IOAuthToken extends Document {
  refreshToken: string;
  clientId: string;
  userId: string;
  scope: string;
  expiresAt: Date;
  revoked: boolean;
}

const OAuthTokenSchema = new Schema<IOAuthToken>(
  {
    refreshToken: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    userId: { type: String, required: true },
    scope: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-delete expired refresh tokens
OAuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthToken = model<IOAuthToken>("OAuthToken", OAuthTokenSchema);
