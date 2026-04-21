function isClaudeFamilyModel(model: string) {
  return /(claude|sonnet|opus|haiku|anthropic)/i.test(model);
}

export function normalizeProviderLabels(message: string) {
  const normalized = message
    .replaceAll("Anthropic", "Claude")
    .replaceAll("OpenAI", "Codex")
    .replaceAll("Claude 协议可用", "Claude 可用")
    .replaceAll("Codex 协议可用", "Codex 可用")
    .replaceAll(
      "Claude 可用（未识别出可测试模型）",
      "Claude 未验证（模型列表可访问，但未识别出可测试模型）",
    )
    .replaceAll(
      "Codex 可用（未识别出可测试模型）",
      "Codex 未验证（模型列表可访问，但未识别出可测试模型）",
    );

  return normalized
    .replace(/Claude\s*可用（测试模型：([^）]+)）/g, (_all, model: string) =>
      isClaudeFamilyModel(model)
        ? `Claude 可用（测试模型：${model}）`
        : `Codex 可用（测试模型：${model}）`,
    )
    .replace(/Codex\s*可用（测试模型：([^）]+)）/g, (_all, model: string) =>
      isClaudeFamilyModel(model)
        ? `Claude 可用（测试模型：${model}）`
        : `Codex 可用（测试模型：${model}）`,
    );
}

function hasSuccessfulAttemptInSummary(summary: string) {
  return summary
    .split(/[，,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => /（(?:可用|延迟)(?:\/\d+ms)?）$/.test(part));
}

function providerIsAvailable(message: string, label: "Claude" | "Codex") {
  const normalizedMessage = normalizeProviderLabels(message);
  const lines = normalizedMessage
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.some((line) => new RegExp(`^${label}\\s*可用`).test(line))) {
    return true;
  }

  const testLine = lines.find((line) => line.startsWith(`${label} 模型测试：`));
  if (!testLine) {
    return false;
  }

  const summary = testLine.slice(`${label} 模型测试：`.length).trim();
  if (
    !summary ||
    summary === "无可用模型" ||
    summary === "无可测模型" ||
    summary.startsWith("未验证")
  ) {
    return false;
  }

  return hasSuccessfulAttemptInSummary(summary);
}

export function getSupportedProviderMap(message: string | null) {
  if (!message) {
    return {
      anthropic: false,
      openai: false,
    };
  }

  return {
    anthropic: providerIsAvailable(message, "Claude"),
    openai: providerIsAvailable(message, "Codex"),
  };
}

export function getSupportedProviders(message: string | null) {
  const supported = getSupportedProviderMap(message);
  const providers: Array<"anthropic" | "openai"> = [];

  if (supported.anthropic) {
    providers.push("anthropic");
  }

  if (supported.openai) {
    providers.push("openai");
  }

  return providers;
}
