"use client"

import { useState } from "react"
import {
  BellIcon,
  BellOffIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import type { LunarDayInfo } from "@/features/chinese-calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface CalendarNoteData {
  id: string
  solarDate: string
  note: string
  color: string
  reminderEnabled: boolean
  reminderEmail: string | null
}

interface DayDetailPanelProps {
  info: LunarDayInfo
  date: Date
  notes: CalendarNoteData[]
  userEmail: string
  onNotesChanged: () => void
}

const PRESET_COLORS = [
  "#f97316",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
]

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function DayDetailPanel({ info, date, notes, userEmail, onNotesChanged }: DayDetailPanelProps) {
  const dateStr = date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })

  const lunarStr = `农历${info.lunarMonth}月${info.lunarDay}`
  const ganZhi = `${info.ganZhiYear}年 ${info.ganZhiMonth}月 ${info.ganZhiDay}日`

  const tags: { text: string; colorClass: string }[] = []
  if (info.jieQi) {
    tags.push({ text: info.jieQi, colorClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" })
  }
  if (info.lunarFestival) {
    tags.push({ text: info.lunarFestival, colorClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" })
  }
  if (info.solarFestival) {
    tags.push({ text: info.solarFestival, colorClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" })
  }
  if (info.isHoliday) {
    tags.push({ text: "休", colorClass: "bg-red-500 text-white" })
  }
  if (info.isWorkday) {
    tags.push({ text: "班", colorClass: "bg-orange-500 text-white" })
  }

  return (
    <div className="space-y-1.5 px-3 py-2 text-sm">
      <div>
        <div className="font-medium">{dateStr}</div>
        <div className="text-muted-foreground text-xs">
          {lunarStr} &middot; {ganZhi}
        </div>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, i) => (
            <span
              key={i}
              className={`rounded px-1.5 py-0.5 text-[0.65rem] leading-none font-medium ${tag.colorClass}`}
            >
              {tag.text}
            </span>
          ))}
        </div>
      )}
      {info.yi.length > 0 && (
        <div className="flex gap-1.5">
          <span className="shrink-0 font-medium text-green-600 dark:text-green-400">
            宜
          </span>
          <span className="text-muted-foreground text-xs leading-5">
            {info.yi.join(" · ")}
          </span>
        </div>
      )}
      {info.ji.length > 0 && (
        <div className="flex gap-1.5">
          <span className="shrink-0 font-medium text-red-600 dark:text-red-400">
            忌
          </span>
          <span className="text-muted-foreground text-xs leading-5">
            {info.ji.join(" · ")}
          </span>
        </div>
      )}

      <NoteSection
        date={date}
        notes={notes}
        userEmail={userEmail}
        onNotesChanged={onNotesChanged}
      />
    </div>
  )
}

function NoteSection({
  date,
  notes,
  userEmail,
  onNotesChanged,
}: {
  date: Date
  notes: CalendarNoteData[]
  userEmail: string
  onNotesChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-1.5 border-t border-border/50 pt-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">备注</span>
        {!adding && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => setAdding(true)}
          >
            <PlusIcon className="size-3" />
          </Button>
        )}
      </div>

      {notes.map((n) =>
        editingId === n.id ? (
          <NoteForm
            key={n.id}
            date={date}
            userEmail={userEmail}
            initial={n}
            onDone={() => {
              setEditingId(null)
              onNotesChanged()
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <NoteItem
            key={n.id}
            note={n}
            onEdit={() => setEditingId(n.id)}
            onDelete={async () => {
              await fetch(`/api/calendar-notes/${n.id}`, { method: "DELETE" })
              onNotesChanged()
            }}
            onTestReminder={async () => {
              await fetch(`/api/calendar-notes/${n.id}`, { method: "POST" })
            }}
          />
        ),
      )}

      {adding && (
        <NoteForm
          date={date}
          userEmail={userEmail}
          onDone={() => {
            setAdding(false)
            onNotesChanged()
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {notes.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">暂无备注</p>
      )}
    </div>
  )
}

function NoteItem({
  note,
  onEdit,
  onDelete,
  onTestReminder,
}: {
  note: CalendarNoteData
  onEdit: () => void
  onDelete: () => void
  onTestReminder: () => void
}) {
  return (
    <div className="rounded-md bg-muted/50">
      <div className="flex items-start gap-1.5">
        <span
          className="mt-1 size-2 shrink-0 rounded-full"
          style={{ backgroundColor: note.color }}
        />
        <p className="min-w-0 flex-1 text-xs leading-relaxed break-words">{note.note}</p>
        <div className="flex shrink-0 gap-0.5">
          {note.reminderEnabled && (
            <Button variant="ghost" size="icon" className="size-5" onClick={onTestReminder} title="发送测试提醒">
              <SendIcon className="size-2.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-5" onClick={onEdit}>
            <PencilIcon className="size-2.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-5" onClick={onDelete}>
            <Trash2Icon className="size-2.5" />
          </Button>
        </div>
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[0.6rem] text-muted-foreground">
        {note.reminderEnabled ? (
          <>
            <BellIcon className="size-2.5 shrink-0" />
            <span className="truncate">
              农历提醒{note.reminderEmail ? ` → ${note.reminderEmail}` : ''}
            </span>
          </>
        ) : (
          <>
            <BellOffIcon className="size-2.5 shrink-0" />
            <span>无提醒</span>
          </>
        )}
      </div>
    </div>
  )
}

function NoteForm({
  date,
  userEmail,
  initial,
  onDone,
  onCancel,
}: {
  date: Date
  userEmail: string
  initial?: CalendarNoteData
  onDone: () => void
  onCancel: () => void
}) {
  const [noteText, setNoteText] = useState(initial?.note ?? "")
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0])
  const [reminderEnabled, setReminderEnabled] = useState(
    initial?.reminderEnabled ?? false,
  )
  const [reminderEmail, setReminderEmail] = useState(
    initial?.reminderEmail ?? "",
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!noteText.trim()) return
    setSaving(true)
    try {
      if (initial) {
        await fetch(`/api/calendar-notes/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: noteText,
            color,
            reminderEnabled,
            reminderEmail: reminderEmail || null,
          }),
        })
      } else {
        await fetch("/api/calendar-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            solarDate: toISODate(date),
            note: noteText,
            color,
            reminderEnabled,
            reminderEmail: reminderEmail || null,
          }),
        })
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1.5 rounded-md border border-border/70 p-2">
      <Input
        placeholder="添加备注..."
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        className="h-7 text-xs"
      />
      <div className="flex items-center gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className="size-4 rounded-full border-2 transition"
            style={{
              backgroundColor: c,
              borderColor: c === color ? "currentColor" : "transparent",
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setReminderEnabled(!reminderEnabled)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
        >
          {reminderEnabled ? (
            <BellIcon className="size-3 text-orange-500" />
          ) : (
            <BellOffIcon className="size-3" />
          )}
          <span>{reminderEnabled ? "每年农历提醒" : "无提醒"}</span>
        </button>
      </div>
      {reminderEnabled && (
        <Input
          placeholder={userEmail || "提醒邮箱"}
          value={reminderEmail}
          onChange={(e) => setReminderEmail(e.target.value)}
          className="h-7 text-xs"
        />
      )}
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onCancel}
        >
          <XIcon className="size-3" />
        </Button>
        <Button
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={!noteText.trim() || saving}
          onClick={() => void handleSave()}
        >
          {initial ? "保存" : "添加"}
        </Button>
      </div>
    </div>
  )
}
