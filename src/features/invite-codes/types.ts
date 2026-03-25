export type InviteCodeListItem = {
  id: string;
  code: string;
  note: string | null;
  createdByEmail: string | null;
  usedByEmail: string | null;
  usedAt: string | null;
  createdAt: string;
};

export type CreateInviteCodeInput = {
  note?: string;
};
