/**
 * Provider response text extraction utilities
 * Shared by managed-keys and chat services
 */

export function extractTextFromValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractTextFromValue(item))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  if (typeof record.output_text === "string") {
    return record.output_text.trim();
  }

  if (typeof record.completion === "string") {
    return record.completion.trim();
  }

  if (typeof record.text === "string") {
    return record.text.trim();
  }

  if (record.text && typeof record.text === "object") {
    const nestedText = extractTextFromValue(record.text);
    if (nestedText) {
      return nestedText;
    }
  }

  if (record.delta && typeof record.delta === "object") {
    const deltaText = extractTextFromValue(record.delta);
    if (deltaText) {
      return deltaText;
    }
  }

  if (record.message && typeof record.message === "object") {
    const messageText = extractTextFromValue(record.message);
    if (messageText) {
      return messageText;
    }
  }

  if (record.content) {
    const contentText = extractTextFromValue(record.content);
    if (contentText) {
      return contentText;
    }
  }

  if (record.output) {
    const outputText = extractTextFromValue(record.output);
    if (outputText) {
      return outputText;
    }
  }

  if (record.parts) {
    const partsText = extractTextFromValue(record.parts);
    if (partsText) {
      return partsText;
    }
  }

  return "";
}

export function extractAnthropicText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  return (
    extractTextFromValue((payload as { content?: unknown }).content) ||
    extractTextFromValue(payload)
  );
}

export function extractOpenAiText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const choices = (payload as { choices?: Array<{ message?: unknown; delta?: unknown }> })
    .choices;

  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const messageText = extractTextFromValue(choice?.message);
      if (messageText) {
        return messageText;
      }

      const deltaText = extractTextFromValue(choice?.delta);
      if (deltaText) {
        return deltaText;
      }
    }
  }

  return (
    extractTextFromValue((payload as { output_text?: unknown }).output_text) ||
    extractTextFromValue((payload as { completion?: unknown }).completion) ||
    extractTextFromValue((payload as { output?: unknown }).output) ||
    extractTextFromValue((payload as { candidates?: unknown }).candidates) ||
    extractTextFromValue(payload)
  );
}
