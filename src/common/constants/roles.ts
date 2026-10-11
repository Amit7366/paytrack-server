export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  USER: "user",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_VALUES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER] as const;

/**
 * Higher rank can manage lower ranks. Add future roles here
 * without changing route or middleware call sites.
 */
export const ROLE_RANK: Record<Role, number> = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.ADMIN]: 50,
  [ROLES.USER]: 10,
};

export const hasMinimumRole = (role: Role, minimum: Role) =>
  ROLE_RANK[role] >= ROLE_RANK[minimum];
