import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ManagedKeyListItem } from "@/features/managed-keys/types";
import { ManagedKeyCard } from "./key-card";
import type { EditDraft } from "./types";

interface KeySectionProps {
  title: string;
  description: string;
  keys: ManagedKeyListItem[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  deletingIds: Record<string, boolean>;
  testingIds: Record<string, boolean>;
  editingIds: Record<string, boolean>;
  savingIds: Record<string, boolean>;
  isBatchTesting: boolean;
  editDrafts: Record<string, EditDraft>;
  onCopyKey: (secret: string) => void;
  onCopyEnv: (text: string) => void;
  onDuplicate: (key: ManagedKeyListItem) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onTogglePinned: (key: ManagedKeyListItem) => void;
  onToggleTestable: (key: ManagedKeyListItem) => void;
  onStartEdit: (key: ManagedKeyListItem) => void;
  onCancelEdit: (id: string) => void;
  onChangeEditDraft: (id: string, patch: Partial<EditDraft>) => void;
  onSaveEdit: (id: string) => void;
}

export function KeySection({
  title,
  description,
  keys,
  isExpanded,
  onToggleExpanded,
  deletingIds,
  testingIds,
  editingIds,
  savingIds,
  isBatchTesting,
  editDrafts,
  onCopyKey,
  onCopyEnv,
  onDuplicate,
  onDelete,
  onTest,
  onTogglePinned,
  onToggleTestable,
  onStartEdit,
  onCancelEdit,
  onChangeEditDraft,
  onSaveEdit,
}: KeySectionProps) {
  if (keys.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={onToggleExpanded}
        >
          {isExpanded ? "收起" : "展开"}
          {isExpanded ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
      {isExpanded ? (
        <div className="flex flex-col gap-1.5">
          {keys.map((key) => (
            <div key={key.id}>
              <ManagedKeyCard
                item={key}
                isDeleting={Boolean(deletingIds[key.id])}
                isTesting={Boolean(testingIds[key.id])}
                isEditing={Boolean(editingIds[key.id])}
                isSaving={Boolean(savingIds[key.id])}
                isBatchTesting={isBatchTesting}
                editDraft={editDrafts[key.id] ?? null}
                onCopyKey={() => onCopyKey(key.secret)}
                onCopyEnv={() => onCopyEnv(key.id)}
                onDuplicate={() => onDuplicate(key)}
                onDelete={() => onDelete(key.id)}
                onTest={() => onTest(key.id)}
                onTogglePinned={() => onTogglePinned(key)}
                onToggleTestable={() => onToggleTestable(key)}
                onStartEdit={() => onStartEdit(key)}
                onCancelEdit={() => onCancelEdit(key.id)}
                onChangeEditDraft={(patch) => onChangeEditDraft(key.id, patch)}
                onSaveEdit={() => onSaveEdit(key.id)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
