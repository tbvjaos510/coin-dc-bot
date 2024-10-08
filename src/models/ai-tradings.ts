import { model, Schema } from "mongoose";

export interface IAITrading {
  _id: string;
  userId: string;
  userMessage: string;
  cronTime?: string;
  lastMessages?: any[];
}

const aiTradingSchema = new Schema<IAITrading>({
  userId: { type: String, required: true, index: true },
  userMessage: { type: String, required: true },
  cronTime: { type: String },
  lastMessages: { type: Array },
});

export const AiTrading = model<IAITrading>("ai-tradings", aiTradingSchema);
