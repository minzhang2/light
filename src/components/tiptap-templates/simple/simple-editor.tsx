"use client"

import { useEffect, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import type { Content } from "@tiptap/react"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Selection } from "@tiptap/extensions"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"

// --- Components ---
import { ThemeToggle } from "@/components/tiptap-templates/simple/theme-toggle"
import { Skeleton } from "@/components/ui/skeleton"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"

import defaultContent from "@/components/tiptap-templates/simple/data/content.json"

function getStaticEditorMarkup(content: Content | string) {
  if (typeof content !== "string") {
    return null
  }

  const trimmed = content.trim()

  if (!trimmed || trimmed === "<p></p>") {
    return null
  }

  return trimmed
}

function EditorLoadingFallback({
  content,
  editable,
}: {
  content: Content | string
  editable: boolean
}) {
  const markup = getStaticEditorMarkup(content)

  if (markup) {
    return (
      <div className="simple-editor-content">
        <div
          aria-hidden={editable || undefined}
          className="simple-editor-fallback tiptap ProseMirror simple-editor"
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      </div>
    )
  }

  return (
    <div className="simple-editor-content">
      <div className="simple-editor-fallback simple-editor-fallback-empty">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-full max-w-[32rem]" />
        <Skeleton className="h-4 w-full max-w-[28rem]" />
        <Skeleton className="h-4 w-full max-w-[30rem]" />
      </div>
    </div>
  )
}

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
}) => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
        <ListDropdownMenu
          modal={false}
          types={["bulletList", "orderedList", "taskList"]}
        />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton text="Add" />
      </ToolbarGroup>

      <Spacer />

      {isMobile && <ToolbarSeparator />}

      <ToolbarGroup>
        <ThemeToggle />
      </ToolbarGroup>
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link"
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
)

const ToolbarLoadingFallback = ({ isMobile }: { isMobile: boolean }) => (
  <>
    <Spacer />

    <ToolbarGroup aria-hidden className="pointer-events-none">
      <Skeleton className="h-8 w-8 rounded-md" />
      <Skeleton className="h-8 w-8 rounded-md" />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup aria-hidden className="pointer-events-none">
      <Skeleton className="h-8 w-10 rounded-md" />
      <Skeleton className="h-8 w-10 rounded-md" />
      <Skeleton className="h-8 w-10 rounded-md" />
      <Skeleton className="h-8 w-10 rounded-md" />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup aria-hidden className="pointer-events-none">
      <Skeleton className="h-8 w-8 rounded-md" />
      <Skeleton className="h-8 w-8 rounded-md" />
      <Skeleton className="h-8 w-8 rounded-md" />
    </ToolbarGroup>

    <Spacer />

    {isMobile && <ToolbarSeparator />}

    <ToolbarGroup aria-hidden className="pointer-events-none">
      <Skeleton className="h-8 w-8 rounded-md" />
    </ToolbarGroup>
  </>
)

export function SimpleEditor({
  content = defaultContent as Content,
  editable = true,
  showToolbar = true,
  onChange,
}: {
  content?: Content | string
  editable?: boolean
  showToolbar?: boolean
  onChange?: (value: string) => void
}) {
  const isMobile = useIsBreakpoint()
  const { height } = useWindowSize()
  const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">(
    "main"
  )
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const toolbarView = isMobile ? mobileView : "main"
  const mobileToolbarReady = !isMobile || height > 0

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
    },
    editable,
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarHeight,
  })

  useEffect(() => {
    const toolbar = toolbarRef.current

    if (!toolbar) {
      return
    }

    const updateToolbarHeight = () => {
      setToolbarHeight(toolbar.getBoundingClientRect().height)
    }

    updateToolbarHeight()

    const observer = new ResizeObserver(() => {
      updateToolbarHeight()
    })

    observer.observe(toolbar)

    return () => {
      observer.disconnect()
    }
  }, [showToolbar])

  useEffect(() => {
    if (!editor) {
      return
    }

    editor.setEditable(editable)
  }, [editable, editor])

  useEffect(() => {
    if (!editor) {
      return
    }

    const nextContent =
      typeof content === "string" && content.trim().length === 0
        ? "<p></p>"
        : content

    const current = JSON.stringify(editor.getJSON())
    const incoming =
      typeof nextContent === "string"
        ? nextContent
        : JSON.stringify(editor.schema.nodeFromJSON(nextContent).toJSON())

    if (typeof nextContent === "string") {
      if (editor.getHTML() !== nextContent) {
        editor.commands.setContent(nextContent, { emitUpdate: false })
      }
      return
    }

    if (current !== incoming) {
      editor.commands.setContent(nextContent, { emitUpdate: false })
    }
  }, [content, editor])

  return (
    <div className="simple-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        {showToolbar ? (
          <Toolbar
            ref={toolbarRef}
            style={{
              ...(isMobile && mobileToolbarReady
                ? {
                    bottom: `calc(100% - ${height - rect.y}px)`,
                  }
                : {}),
              ...(isMobile && !mobileToolbarReady
                ? { visibility: "hidden" as const }
                : {}),
            }}
          >
            {editor ? (
              toolbarView === "main" ? (
                <MainToolbarContent
                  onHighlighterClick={() => setMobileView("highlighter")}
                  onLinkClick={() => setMobileView("link")}
                  isMobile={isMobile}
                />
              ) : (
                <MobileToolbarContent
                  type={toolbarView === "highlighter" ? "highlighter" : "link"}
                  onBack={() => setMobileView("main")}
                />
              )
            ) : (
              <ToolbarLoadingFallback isMobile={isMobile} />
            )}
          </Toolbar>
        ) : null}

        {editor ? (
          <EditorContent
            editor={editor}
            role="presentation"
            className="simple-editor-content"
          />
        ) : (
          <EditorLoadingFallback content={content} editable={editable} />
        )}
      </EditorContext.Provider>
    </div>
  )
}
