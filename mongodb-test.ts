import { MongoMemoryServer } from "mongodb-memory-server";
import * as mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

let mongoServer: MongoMemoryServer;

const connectMongoDB = async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
};

const disconnectMongoDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
};

beforeAll(async () => {
  await connectMongoDB();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await disconnectMongoDB();
});
