import { model, Schema } from "mongoose";

export interface IUser {
  _id: string;
  userId: string;
  serverId: string;
  channelId: string;
  nickname: string;
  initialBalance: number;
  upbitApiKey?: string;
  upbitSecretKey?: string;
}

const userSchema = new Schema<IUser>({
  userId: { type: String, required: true, index: true },
  serverId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  nickname: { type: String, required: true },
  initialBalance: { type: Number, required: true },
  upbitApiKey: { type: String },
  upbitSecretKey: { type: String },
});

export const User = model<IUser>("users", userSchema);
