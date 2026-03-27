export type ManagedUserActivitySummary = {
  chatSessionCount: number;
  chatMessageCount: number;
  mailboxCount: number;
  lastChatAt: string | null;
  lastMailboxAt: string | null;
  lastActiveAt: string | null;
};

export type ManagedUserListItem = {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
  roleSource: "database" | "environment";
  createdAt: string;
  activity: ManagedUserActivitySummary;
};

export type UpdateManagedUserRoleInput = {
  email: string;
  role: "user" | "admin";
  actorEmail?: string | null;
};
