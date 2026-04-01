export type ManagedKeyGroup = "claude" | "codex";

export type ManagedKeyProtocol = "anthropic" | "openai";

export type ManagedKeyLaunchCommand = "claude" | "codex" | null;

export type ParsedManagedKeyInput = {
  name: string;
  aliases: string[];
  group: ManagedKeyGroup;
  protocol: ManagedKeyProtocol;
  secret: string;
  baseUrl: string;
  model: string | null;
  launchCommand: ManagedKeyLaunchCommand;
  extraEnv: Record<string, string>;
  fingerprint: string;
};

export type ManagedKeyListItem = {
  id: string;
  name: string;
  aliases: string[];
  group: ManagedKeyGroup;
  protocol: ManagedKeyProtocol;
  secret: string;
  maskedSecret: string;
  baseUrl: string;
  model: string | null;
  launchCommand: ManagedKeyLaunchCommand;
  extraEnv: Record<string, string>;
  availableModels: string[];
  copyText: string;
  isTestable: boolean;
  isPinned: boolean;
  lastTestStatus: "success" | "error" | null;
  lastTestMessage: string | null;
  lastTestAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ManagedKeyTestResult = {
  ok: boolean;
  message: string;
  statusCode: number | null;
  testedAt: string;
  discoveredModel: string | null;
  discoveredModels: string[];
  attemptedModels: Array<{
    model: string;
    ok: boolean;
    statusCode: number | null;
    message: string;
    source: "preferred" | "fallback";
  }>;
};

export type ManagedKeyUpdateInput = {
  name?: string;
  secret?: string;
  baseUrl?: string;
  model?: string | null;
  launchCommand?: ManagedKeyLaunchCommand;
  isTestable?: boolean;
  isPinned?: boolean;
};

export type GlobalConfig = {
  preferredModels: string[];
};
