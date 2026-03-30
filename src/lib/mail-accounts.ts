export interface MailAccount {
  label: string;
  key: string;
}

export function getMailAccounts(): MailAccount[] {
  const raw = process.env.MAIL_ACCOUNTS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is MailAccount =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).label === "string" &&
        typeof (item as Record<string, unknown>).key === "string",
    );
  } catch {
    return [];
  }
}

export function getMailAccountByIndex(index: number): MailAccount | null {
  const accounts = getMailAccounts();
  return accounts[index] ?? null;
}
