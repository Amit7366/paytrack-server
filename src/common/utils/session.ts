import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env";
import { Role } from "../constants/roles";

export const SESSION_COOKIE = "session";

const secret = () => new TextEncoder().encode(env.jwtSecret);

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const signSession = (userId: string, role: Role) =>
  new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.jwtExpiresIn)
    .sign(secret());

export const verifySession = async (token: string) => {
  const { payload } = await jwtVerify(token, secret());
  const userId = typeof payload.userId === "string" ? payload.userId : payload.sub;
  const role = payload.role;
  if (!userId || (role !== "super_admin" && role !== "admin" && role !== "user")) {
    return null;
  }
  return { userId, role };
};
