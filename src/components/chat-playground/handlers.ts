import type { ChatMessage } from "./types";
import type { ChatKeyOption, ChatSessionDetail } from "@/features/chat/types";
import * as api from "./api";
import { getMessagesForRequest, formatAttachmentNames, buildUserMessagePreview, makeMessageId, isAbortError } from "./utils";

interface SendMessageParams {
  content: string;
  pendingFiles: File[];
  messages: ChatMessage[];
  selectedKey: ChatKeyOption;
  selectedModel: string;
  sessionId: string | null;
  controller: AbortController;
  ensureSession: (firstMessage: string, signal?: AbortSignal) => Promise<string | null>;
  onSuccess: (assistantMessage: ChatMessage) => void;
  onError: (error: unknown) => void;
}

export async function sendMessage(params: SendMessageParams) {
  const {
    content,
    pendingFiles,
    messages,
    selectedKey,
    selectedModel,
    controller,
    ensureSession,
    onSuccess,
    onError,
  } = params;

  // Build user message preview for optimistic UI update
  makeMessageId();
  buildUserMessagePreview(content, pendingFiles);

  const requestMessages = [
    ...getMessagesForRequest(messages),
    { role: "user" as const, content },
  ];

  try {
    const activeSessionId = await ensureSession(
      content || formatAttachmentNames(pendingFiles),
      controller.signal,
    );

    if (controller.signal.aborted) {
      return;
    }

    const result = await api.sendChatMessage({
      keyId: selectedKey.id,
      model: selectedModel,
      messages: requestMessages,
      sessionId: activeSessionId,
      files: pendingFiles,
      signal: controller.signal,
    });

    if (controller.signal.aborted) {
      return;
    }

    onSuccess({
      id: makeMessageId(),
      role: "assistant",
      content: result.content,
      keyName: result.keyName,
      model: result.model,
    });
  } catch (error) {
    if (!isAbortError(error)) {
      onError(error);
    }
  }
}

interface RetryMessageParams {
  messageId: string;
  messages: ChatMessage[];
  selectedKey: ChatKeyOption;
  selectedModel: string;
  sessionId: string | null;
  controller: AbortController;
  onSuccess: (assistantMessage: ChatMessage) => void;
  onError: (error: unknown) => void;
}

export async function retryMessage(params: RetryMessageParams) {
  const {
    messageId,
    messages,
    selectedKey,
    selectedModel,
    sessionId,
    controller,
    onSuccess,
    onError,
  } = params;

  const targetIndex = messages.findIndex((m) => m.id === messageId);
  if (targetIndex === -1) {
    return;
  }

  const requestMessages = getMessagesForRequest(messages.slice(0, targetIndex + 1));

  try {
    const result = await api.sendChatMessage({
      keyId: selectedKey.id,
      model: selectedModel,
      messages: requestMessages,
      sessionId,
      files: [],
      signal: controller.signal,
    });

    if (controller.signal.aborted) {
      return;
    }

    onSuccess({
      id: makeMessageId(),
      role: "assistant",
      content: result.content,
      keyName: result.keyName,
      model: result.model,
    });
  } catch (error) {
    if (!isAbortError(error)) {
      onError(error);
    }
  }
}

interface DeleteMessageParams {
  messageId: string;
  sessionId: string | null;
  onSuccess: () => void;
  onError: (error: unknown) => void;
}

export async function deleteMessage(params: DeleteMessageParams) {
  const { messageId, sessionId, onSuccess, onError } = params;

  if (!sessionId) {
    return;
  }

  try {
    await api.deleteMessage(sessionId, messageId);
    onSuccess();
  } catch (error) {
    onError(error);
  }
}

export function getInitialState(
  keys: ChatKeyOption[],
  initialSession?: ChatSessionDetail | null,
) {
  const messages = (initialSession?.messages ?? []).map((m) => ({ ...m }));
  const isInitialViewportReady = messages.length === 0;

  return {
    messages,
    isInitialViewportReady,
  };
}

export function syncSessionState(
  externalSessionId: string | null,
  initialSession: ChatSessionDetail | null | undefined,
  keys: ChatKeyOption[],
  pendingCreatedSessionId: string | null,
  currentMessages: ChatMessage[],
) {
  if (externalSessionId === null) {
    return {
      shouldClear: true,
      messages: [],
      keyId: null,
      model: "",
      clearPending: true,
    };
  }

  if (initialSession) {
    const isPendingCreated =
      externalSessionId === pendingCreatedSessionId &&
      initialSession.messages.length === 0 &&
      currentMessages.length > 0;

    if (isPendingCreated) {
      return null;
    }

    return {
      shouldClear: false,
      messages: initialSession.messages.map((m) => ({ ...m })),
      keyId: initialSession.keyId,
      model: initialSession.model,
      clearPending: true,
    };
  }

  return null;
}
