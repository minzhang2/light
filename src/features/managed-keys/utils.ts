import type { ManagedKeyListItem } from "@/features/managed-keys/types";

function asTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function compareManagedKeysForDisplay(
  a: ManagedKeyListItem,
  b: ManagedKeyListItem,
) {
  if (a.isPinned !== b.isPinned) {
    return a.isPinned ? -1 : 1;
  }

  if (a.isPinned && b.isPinned) {
    return asTimestamp(b.updatedAt) - asTimestamp(a.updatedAt);
  }

  return asTimestamp(b.createdAt) - asTimestamp(a.createdAt);
}
