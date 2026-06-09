import { Schema, model, Document } from "mongoose";

export interface IOAuthClient extends Document {
  clientId: string;
  clientSecret: string | null;
  name: string;
  redirectUris: string[];
  scopes: string[];
}

const OAuthClientSchema = new Schema<IOAuthClient>(
  {
    clientId: { type: String, required: true, unique: true },
    clientSecret: { type: String, default: null },
    name: { type: String, required: true },
    redirectUris: [{ type: String, required: true }],
    scopes: [{ type: String }],
  },
  { timestamps: true }
);

export const OAuthClient = model<IOAuthClient>("OAuthClient", OAuthClientSchema);
