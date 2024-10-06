import { connect } from "mongoose";

export const initMongoDB = async () => {
  await connect(process.env.MONGO_URI!, {
    auth: {
      username: process.env.MONGO_USERNAME!,
      password: process.env.MONGO_PASSWORD!,
    },
    dbName: process.env.MONGO_DB_NAME!,
  });

  console.log("MongoDB connected");
}
