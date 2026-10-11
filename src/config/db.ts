import mongoose from "mongoose";
import { env } from "./env";
import { ROLES } from "../common/constants/roles";
import { User } from "../modules/user/user.model";

export const connectDatabase = async () => {
  await mongoose.connect(env.mongoUri);

  const seeds = [
    { ...env.superAdmin, role: ROLES.SUPER_ADMIN },
    { ...env.admin, role: ROLES.ADMIN },
  ];

  for (const seed of seeds) {
    const existing = await User.findOne({ email: seed.email.toLowerCase() });
    if (existing) continue;

    await User.create({
      name: seed.name,
      email: seed.email,
      password: seed.password,
      role: seed.role,
    });
    console.log(`Seeded ${seed.role}: ${seed.email}`);
  }
};
