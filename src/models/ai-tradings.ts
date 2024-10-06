import { model, Schema } from "mongoose";

export interface IAITrading {
  _id: string;
  userId: string;
  systemMessage?: string;
  userMessage: string;
  cronTime?: string;
  lastMessages?: any[];
}

const aiTradingSchema = new Schema<IAITrading>({
  userId: { type: String, required: true, index: true },
  systemMessage: { type: String },
  userMessage: { type: String, required: true },
  cronTime: { type: String },
  lastMessages: { type: Array },
});

export const AiTrading = model<IAITrading>("ai-tradings", aiTradingSchema);
