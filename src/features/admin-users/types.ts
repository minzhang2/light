export type ManagedUserListItem = {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
  roleSource: "database" | "environment";
  createdAt: string;
};

export type UpdateManagedUserRoleInput = {
  email: string;
  role: "user" | "admin";
  actorEmail?: string | null;
};
