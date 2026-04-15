import type { JsonRecord } from "./types";

export function now() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

export function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as JsonRecord;
}

export function isSuccessResponse(response: Response, json: unknown) {
  if (!response.ok) {
    return false;
  }

  const record = asRecord(json);
  if (!record) {
    return false;
  }

  if (typeof record.code === "number") {
    return record.code === 0;
  }

  if (typeof record.success === "boolean") {
    return record.success;
  }

  return true;
}

export function getMessage(json: unknown, fallback: string) {
  const record = asRecord(json);
  if (!record) {
    return fallback;
  }

  if (typeof record.message === "string") {
    return record.message;
  }

  if (typeof record.msg === "string") {
    return record.msg;
  }

  if (typeof record.detail === "string") {
    return record.detail;
  }

  const error = asRecord(record.error);
  if (typeof error?.message === "string") {
    return error.message;
  }

  return fallback;
}

export function compactJson(value: unknown, maxLength = 200) {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (!text) {
      return "";
    }

    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  } catch {
    return "";
  }
}

export function getApiEcho(response: Response, json: unknown) {
  const record = asRecord(json);
  const pieces: string[] = [`HTTP ${response.status}`];

  if (record) {
    const codeValue = record.code ?? record.error_code;
    if (typeof codeValue === "number" || typeof codeValue === "string") {
      pieces.push(`code=${String(codeValue)}`);
    }
  }

  const message = getMessage(json, "");
  if (message) {
    pieces.push(message);
  } else {
    const raw = compactJson(json);
    if (raw) {
      pieces.push(raw);
    }
  }

  return pieces.join(" | ");
}

export function getPayload(json: unknown) {
  const root = asRecord(json);
  if (!root) {
    return null;
  }

  return asRecord(root.data) ?? root;
}
