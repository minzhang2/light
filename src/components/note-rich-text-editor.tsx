"use client";

import { useEffect } from "react";
import {
  BoldIcon,
  Heading1Icon,
  Heading2Icon,
  ItalicIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  Redo2Icon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function normalizeEditorContent(content: string) {
  const trimmed = content.trim();

  if (!trimmed) {
    return "<p></p>";
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return content;
  }

  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function NoteRichTextEditor({
  value,
  editable,
  onChange,
}: {
  value: string;
  editable: boolean;
  onChange?: (value: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
        },
        orderedList: {
          keepMarks: true,
        },
      }),
      Underline,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: "在这里开始写内容...",
      }),
    ],
    content: normalizeEditorContent(value),
    editorProps: {
      attributes: {
        class:
          "ProseMirror min-h-[560px] px-4 py-5 outline-none md:px-6 text-sm leading-7",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const normalized = normalizeEditorContent(value);
    if (editor.getHTML() !== normalized) {
      editor.commands.setContent(normalized, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {editable ? <EditorToolbar editor={editor} /> : null}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          editable
            ? "border-t border-border/70"
            : "",
        )}
      >
        <EditorContent
          editor={editor}
          className={cn(
            "h-full",
            "[&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-semibold",
            "[&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-semibold",
            "[&_.ProseMirror_p]:mb-3 [&_.ProseMirror_p:last-child]:mb-0",
            "[&_.ProseMirror_blockquote]:my-4 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-primary/40 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:text-muted-foreground",
            "[&_.ProseMirror_ul]:my-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6",
            "[&_.ProseMirror_ol]:my-4 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6",
            "[&_.ProseMirror_li]:mb-1",
            "[&_.ProseMirror_ul[data-type='taskList']]:list-none [&_.ProseMirror_ul[data-type='taskList']]:pl-0",
            "[&_.ProseMirror_ul[data-type='taskList']_li]:flex [&_.ProseMirror_ul[data-type='taskList']_li]:items-start [&_.ProseMirror_ul[data-type='taskList']_li]:gap-2",
            "[&_.ProseMirror_ul[data-type='taskList']_label]:mt-1",
            "[&_.ProseMirror_ul[data-type='taskList']_div]:flex-1",
            "[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline",
            "[&_.ProseMirror_code]:rounded-sm [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-0.5",
            "[&_.ProseMirror_pre]:my-4 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-xl [&_.ProseMirror_pre]:bg-zinc-950 [&_.ProseMirror_pre]:px-4 [&_.ProseMirror_pre]:py-3 [&_.ProseMirror_pre]:text-zinc-50",
            "[&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          )}
        />
      </div>
    </div>
  );
}

function EditorToolbar({
  editor,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
}) {
  const actions = [
    {
      label: "标题 1",
      icon: Heading1Icon,
      isActive: editor.isActive("heading", { level: 1 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "标题 2",
      icon: Heading2Icon,
      isActive: editor.isActive("heading", { level: 2 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "加粗",
      icon: BoldIcon,
      isActive: editor.isActive("bold"),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "斜体",
      icon: ItalicIcon,
      isActive: editor.isActive("italic"),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "下划线",
      icon: UnderlineIcon,
      isActive: editor.isActive("underline"),
      onClick: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "引用",
      icon: QuoteIcon,
      isActive: editor.isActive("blockquote"),
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "列表",
      icon: ListIcon,
      isActive: editor.isActive("bulletList"),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "编号",
      icon: ListOrderedIcon,
      isActive: editor.isActive("orderedList"),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "待办",
      icon: ListChecksIcon,
      isActive: editor.isActive("taskList"),
      onClick: () => editor.chain().focus().toggleTaskList().run(),
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 px-4 py-3 md:px-6">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.isActive ? "secondary" : "outline"}
          size="sm"
          onClick={action.onClick}
        >
          <action.icon />
          {action.label}
        </Button>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
        >
          <Undo2Icon />
          撤销
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
        >
          <Redo2Icon />
          重做
        </Button>
      </div>
    </div>
  );
}
