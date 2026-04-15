export interface MailAccount {
  index: number;
  label: string;
}

export interface Mailbox {
  id: number;
  email: string;
  created_at: number;
  mailbox_type: string;
}

export interface Email {
  id: number;
  subject?: string;
  from_addr?: string;
  from?: string;
  mailbox_id?: number;
  mailbox_email?: string;
  verification_code?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  time: string;
  type: "info" | "success" | "error";
  message: string;
}

export const DOMAINS = [
  { label: "seekpj.fun", value: "9" },
] as const;

export type DomainValue = (typeof DOMAINS)[number]["value"];

export type JsonRecord = Record<string, unknown>;

export const API_BASE = "/api/mail";
