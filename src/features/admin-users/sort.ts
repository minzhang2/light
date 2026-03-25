import type { ManagedUserListItem } from "@/features/admin-users/types";

export function compareManagedUsers(
  a: ManagedUserListItem,
  b: ManagedUserListItem,
) {
  if (a.roleSource !== b.roleSource) {
    return a.roleSource === "environment" ? -1 : 1;
  }

  if (a.role !== b.role) {
    return a.role === "admin" ? -1 : 1;
  }

  return a.email.localeCompare(b.email, "en");
}
