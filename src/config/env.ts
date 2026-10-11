import dotenv from "dotenv";

dotenv.config();

const required = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/payment_management"),
  jwtSecret: required("JWT_SECRET", "dev-only-change-this-secret"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
  superAdmin: {
    name: process.env.SUPER_ADMIN_NAME ?? "Super Admin",
    email: process.env.SUPER_ADMIN_EMAIL ?? "superadmin@example.com",
    password: process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe123!",
  },
  admin: {
    name: process.env.ADMIN_NAME ?? "Admin",
    email: process.env.ADMIN_EMAIL ?? "admin@example.com",
    password: process.env.ADMIN_PASSWORD ?? "ChangeMe123!",
  },
};
