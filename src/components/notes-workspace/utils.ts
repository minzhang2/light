import { formatInAppTimeZone, getTimeZoneDayIndex } from "@/lib/date-time";
import type { NoteDocument } from "./types";

export function formatSavedTime(value: string) {
  return formatInAppTimeZone(value, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatSavedLabel(value: string) {
  return `已保存 ${formatSavedTime(value)}`;
}

export function sortDocuments(left: NoteDocument, right: NoteDocument) {
  if (left.isPinned !== right.isPinned) {
    return left.isPinned ? -1 : 1;
  }

  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function groupDocuments(documents: NoteDocument[], now: number) {
  const todayIndex = getTimeZoneDayIndex(now);
  const groups: { label: string; items: NoteDocument[] }[] = [
    { label: "已置顶", items: [] },
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "最近 7 天", items: [] },
    { label: "更早", items: [] },
  ];

  for (const doc of documents) {
    if (doc.isPinned) {
      groups[0].items.push(doc);
      continue;
    }
    const dayDiff = todayIndex - getTimeZoneDayIndex(doc.updatedAt);

    if (dayDiff <= 0) {
      groups[1].items.push(doc);
    } else if (dayDiff === 1) {
      groups[2].items.push(doc);
    } else if (dayDiff < 7) {
      groups[3].items.push(doc);
    } else {
      groups[4].items.push(doc);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

export function buildShareUrl(shareToken: string, origin = "") {
  if (!origin) {
    return `/share/note/${shareToken}`;
  }

  return `${origin}/share/note/${shareToken}`;
}
