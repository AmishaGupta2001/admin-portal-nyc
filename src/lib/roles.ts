// Role hierarchy + permission matrix. Used on both server and client.
export const ROLES = ["user", "moderator", "admin", "superadmin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<Role, number> = { user: 0, moderator: 1, admin: 2, superadmin: 3 };

export const ROLE_META: Record<Role, { label: string; blurb: string }> = {
  user: { label: "User", blurb: "Regular app user. No admin panel access." },
  moderator: { label: "Moderator", blurb: "Moderate posts, view users and votes." },
  admin: { label: "Admin", blurb: "Manage users, media, tags and publish posts." },
  superadmin: { label: "Superadmin", blurb: "Everything, including roles, deletions and audit log." },
};

export type Permission =
  | "panel.access"
  | "content.moderate" // hide / feature / edit caption / delete generation
  | "users.view"
  | "users.edit" // edit name, ban/unban regular users
  | "users.invite"
  | "users.ban_staff" // ban admins / moderators
  | "users.assign_role"
  | "users.delete"
  | "media.manage" // images CRUD, tags
  | "studio.use" // generate + publish posts
  | "studio.post_as_other"
  | "votes.moderate"
  | "audit.view"
  | "system.view";

const MIN_ROLE: Record<Permission, Role> = {
  "panel.access": "moderator",
  "content.moderate": "moderator",
  "users.view": "moderator",
  "users.edit": "admin",
  "users.invite": "admin",
  "users.ban_staff": "superadmin",
  "users.assign_role": "superadmin",
  "users.delete": "superadmin",
  "media.manage": "admin",
  "studio.use": "admin",
  "studio.post_as_other": "admin",
  "votes.moderate": "moderator",
  "audit.view": "admin",
  "system.view": "admin",
};

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export function can(role: Role | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[MIN_ROLE[perm]];
}

export function minRoleFor(perm: Permission): Role {
  return MIN_ROLE[perm];
}
