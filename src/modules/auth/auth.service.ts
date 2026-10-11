import bcrypt from "bcryptjs";
import { ROLES } from "../../common/constants/roles";
import { AppError } from "../../common/errors/AppError";
import { signSession } from "../../common/utils/session";
import { toPublicUser, User } from "../user/user.model";

const authPayload = async (user: Parameters<typeof toPublicUser>[0]) => ({
  token: await signSession(user._id.toString(), user.role),
  user: toPublicUser(user),
});

export const registerUser = async (input: { name: string; email: string; password: string }) => {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  const user = await User.create({
    name: input.name,
    email: input.email,
    password: input.password,
    role: ROLES.USER,
  });

  return { user: toPublicUser(user) };
};

export const loginUser = async (input: { email: string; password: string }) => {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select("+password");
  if (!user || !(await bcrypt.compare(input.password, user.password))) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError("This account is inactive", 403);
  }

  return authPayload(user);
};

export const updateProfile = async (
  userId: string,
  input: { name?: string; currentPassword?: string; newPassword?: string },
) => {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new AppError("User not found", 404);
  if (input.name) user.name = input.name.trim();
  if (input.newPassword) {
    if (!input.currentPassword || !(await bcrypt.compare(input.currentPassword, user.password))) {
      throw new AppError("Current password is incorrect", 422);
    }
    user.password = input.newPassword;
  }
  await user.save();
  return toPublicUser(user);
};

export const getProfile = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return toPublicUser(user);
};
