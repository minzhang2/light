import { createHash } from "node:crypto";

import type {
  ManagedKeyGroup,
  ManagedKeyLaunchCommand,
  ManagedKeyProtocol,
  ParsedManagedKeyInput,
} from "@/features/managed-keys/types";
import { normalizeBaseUrl } from "@/features/managed-keys/utils";

type BlockState = {
  label: string | null;
  values: Record<string, string>;
  launchCommand: ManagedKeyLaunchCommand;
};

const KNOWN_LABEL_NOISE = new Set(["codex", "claude", "备用地址", "本地"]);

function createEmptyBlock(label: string | null = null): BlockState {
  return {
    label,
    values: {},
    launchCommand: null,
  };
}

function parseExportLine(line: string) {
  const match = line.match(/^export\s+([A-Z0-9_]+)=(.*)$/);

  if (!match) {
    return null;
  }

  const [, key, rawValue] = match;
  const value = rawValue.trim().replace(/^['"]|['"]$/g, "");

  return { key, value };
}

function blockHasAuthToken(block: BlockState) {
  return Boolean(block.values.ANTHROPIC_AUTH_TOKEN || block.values.OPENAI_API_KEY);
}

function normalizeLabel(label: string | null) {
  if (!label) {
    return null;
  }

  const normalized = label.trim().replace(/^\/+\s*/, "").replace(/\s+/g, " ");
  return normalized || null;
}

export function buildManagedKeyFingerprint(parts: Array<string | null>) {
  return createHash("sha256")
    .update(parts.filter(Boolean).join("|"))
    .digest("hex");
}

function inferGroup({
  label,
  protocol,
  model,
  launchCommand,
}: {
  label: string | null;
  protocol: ManagedKeyProtocol;
  model: string | null;
  launchCommand: ManagedKeyLaunchCommand;
}): ManagedKeyGroup {
  const haystack = [label, model, launchCommand, protocol].filter(Boolean).join(" ").toLowerCase();

  if (launchCommand === "codex" || protocol === "openai") {
    return "codex";
  }

  if (haystack.includes("codex") || haystack.includes("gpt-5") || haystack.includes("gpt-4.1")) {
    return "codex";
  }

  return "claude";
}

function getDisplayName(label: string | null, baseUrl: string, group: ManagedKeyGroup) {
  const normalizedLabel = normalizeLabel(label);

  if (normalizedLabel && !KNOWN_LABEL_NOISE.has(normalizedLabel.toLowerCase())) {
    return normalizedLabel;
  }

  try {
    const hostname = new URL(baseUrl).hostname.replace(/^www\./, "");
    return hostname || `${group.toUpperCase()} Key`;
  } catch {
    return normalizedLabel ?? `${group.toUpperCase()} Key`;
  }
}

function extractExtraEnv(values: Record<string, string>, protocol: ManagedKeyProtocol) {
  const entries = Object.entries(values).filter(([key]) => {
    if (protocol === "anthropic") {
      return !["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "ANTHROPIC_MODEL"].includes(key);
    }

    return !["OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL"].includes(key);
  });

  return Object.fromEntries(entries);
}

function finalizeBlock(block: BlockState) {
  const protocol = block.values.OPENAI_API_KEY ? "openai" : block.values.ANTHROPIC_AUTH_TOKEN ? "anthropic" : null;

  if (!protocol) {
    return null;
  }

  const secret =
    protocol === "openai" ? block.values.OPENAI_API_KEY : block.values.ANTHROPIC_AUTH_TOKEN;
  const baseUrl =
    protocol === "openai" ? block.values.OPENAI_BASE_URL : block.values.ANTHROPIC_BASE_URL;
  const model =
    protocol === "openai" ? block.values.OPENAI_MODEL ?? null : block.values.ANTHROPIC_MODEL ?? null;

  if (!secret || !baseUrl) {
    return null;
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const group = inferGroup({
    label: block.label,
    protocol,
    model,
    launchCommand: block.launchCommand,
  });
  const name = getDisplayName(block.label, normalizedBaseUrl, group);
  const extraEnv = extractExtraEnv(block.values, protocol);
  const fingerprint = buildManagedKeyFingerprint([
    protocol,
    normalizedBaseUrl,
    secret,
    model,
    block.launchCommand,
  ]);

  return {
    name,
    aliases: block.label && block.label !== name ? [block.label] : [],
    group,
    protocol,
    secret,
    baseUrl: normalizedBaseUrl,
    model,
    launchCommand: block.launchCommand,
    extraEnv,
    fingerprint,
  } satisfies ParsedManagedKeyInput;
}

function mergeParsedKeys(entries: ParsedManagedKeyInput[]) {
  const merged = new Map<string, ParsedManagedKeyInput>();

  for (const entry of entries) {
    const existing = merged.get(entry.fingerprint);

    if (!existing) {
      merged.set(entry.fingerprint, entry);
      continue;
    }

    const aliasSet = new Set([
      existing.name,
      ...existing.aliases,
      entry.name,
      ...entry.aliases,
    ]);

    aliasSet.delete(existing.name);

    const nextName =
      KNOWN_LABEL_NOISE.has(existing.name.toLowerCase()) && !KNOWN_LABEL_NOISE.has(entry.name.toLowerCase())
        ? entry.name
        : existing.name;

    merged.set(entry.fingerprint, {
      ...existing,
      name: nextName,
      aliases: [...aliasSet].filter((value) => value !== nextName),
      group: existing.group === "codex" || entry.group === "codex" ? "codex" : "claude",
      launchCommand: existing.launchCommand ?? entry.launchCommand,
      extraEnv: {
        ...existing.extraEnv,
        ...entry.extraEnv,
      },
    });
  }

  return [...merged.values()];
}

export function parseManagedKeys(raw: string) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const parsed: ParsedManagedKeyInput[] = [];
  let pendingLabel: string | null = null;
  let block = createEmptyBlock();

  const flush = () => {
    const finalized = finalizeBlock(block);

    if (finalized) {
      parsed.push(finalized);
    }

    block = createEmptyBlock();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("//")) {
      if (Object.keys(block.values).length > 0 || block.launchCommand) {
        flush();
      }

      pendingLabel = normalizeLabel(line.slice(2));
      continue;
    }

    if (line === "claude" || line === "codex") {
      if (!block.label && pendingLabel) {
        block.label = pendingLabel;
        pendingLabel = null;
      }

      block.launchCommand = line;
      flush();
      continue;
    }

    const parsedLine = parseExportLine(line);

    if (!parsedLine) {
      continue;
    }

    const isAuthStart =
      parsedLine.key === "ANTHROPIC_AUTH_TOKEN" || parsedLine.key === "OPENAI_API_KEY";

    // Auth env signals a new block only when a block already has auth;
    // this allows valid orders like BASE_URL first, AUTH_TOKEN second.
    if (isAuthStart && blockHasAuthToken(block)) {
      flush();
    }

    if (!block.label && pendingLabel) {
      block.label = pendingLabel;
      pendingLabel = null;
    }

    block.values[parsedLine.key] = parsedLine.value;
  }

  flush();

  return mergeParsedKeys(parsed);
}

export function maskSecret(secret: string) {
  if (secret.length <= 12) {
    return secret;
  }

  return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
}
