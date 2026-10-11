import { ROLES, Role } from "./constants/roles";

export type AccessActor = { id: string; role: Role };

export type OwnedUser = { id: string; createdById: string | null };

export type AccessDecision = "allow" | "forbid" | "hide";

export const paymentAccess = (actor: AccessActor, user: OwnedUser): AccessDecision => {
  if (actor.role === ROLES.SUPER_ADMIN) return "allow";
  if (actor.role === ROLES.USER) return actor.id === user.id ? "allow" : "forbid";
  if (actor.role === ROLES.ADMIN) return user.createdById === actor.id ? "allow" : "hide";
  return "forbid";
};
