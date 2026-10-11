import mongoose, { ClientSession } from "mongoose";

export const withTransaction = async <T>(work: (session: ClientSession) => Promise<T>) => {
  const session = await mongoose.startSession();
  try {
    let value: T | undefined;
    await session.withTransaction(async () => {
      value = await work(session);
    });
    return value as T;
  } finally {
    await session.endSession();
  }
};
