import { ROLES, Role } from "../../common/constants/roles";
import { AppError } from "../../common/errors/AppError";
import { toPublicUser, User } from "./user.model";

export const listUsers = async (actor: { id: string; role: Role }) => {
  const filter: Record<string, unknown> = {};
  if (actor.role === ROLES.ADMIN) {
    filter.$or = [{ _id: actor.id }, { createdById: actor.id }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 });
  return users.map((user) => toPublicUser(user));
};

export const updateUserRole = async (actorId: string, targetId: string, role: Role) => {
  if (actorId === targetId && role !== ROLES.SUPER_ADMIN) {
    throw new AppError("You cannot remove your own super admin role", 422);
  }

  const user = await User.findById(targetId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.role === ROLES.SUPER_ADMIN && role !== ROLES.SUPER_ADMIN) {
    const superAdminCount = await User.countDocuments({ role: ROLES.SUPER_ADMIN });
    if (superAdminCount <= 1) {
      throw new AppError("At least one super admin must remain", 422);
    }
  }

  user.role = role;
  await user.save();
  return toPublicUser(user);
};
