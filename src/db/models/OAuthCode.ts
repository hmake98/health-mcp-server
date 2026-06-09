import { Schema, model, Document } from "mongoose";

export interface IOAuthCode extends Document {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  expiresAt: Date;
  used: boolean;
}

const OAuthCodeSchema = new Schema<IOAuthCode>(
  {
    code: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    userId: { type: String, required: true },
    redirectUri: { type: String, required: true },
    scope: { type: String, required: true },
    codeChallenge: { type: String, default: null },
    codeChallengeMethod: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-delete expired codes
OAuthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthCode = model<IOAuthCode>("OAuthCode", OAuthCodeSchema);
