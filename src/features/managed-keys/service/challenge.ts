const DEGRADED_THRESHOLD_MS = 6_000;

export type ManagedKeyChallenge = {
  prompt: string;
  expectedAnswer: string;
};

export function getDegradedLatencyThresholdMs() {
  return DEGRADED_THRESHOLD_MS;
}

function buildPromptWithExamples(question: string) {
  return `Calculate and respond with ONLY the number, nothing else.

Q: 3 + 5 = ?
A: 8

Q: 12 - 7 = ?
A: 5

Q: ${question}
A:`;
}

export function generateManagedKeyChallenge(): ManagedKeyChallenge {
  const a = Math.floor(Math.random() * 50) + 1;
  const b = Math.floor(Math.random() * 50) + 1;
  const isAddition = Math.random() > 0.5;

  if (isAddition) {
    return {
      prompt: buildPromptWithExamples(`${a} + ${b} = ?`),
      expectedAnswer: String(a + b),
    };
  }

  const larger = Math.max(a, b);
  const smaller = Math.min(a, b);
  return {
    prompt: buildPromptWithExamples(`${larger} - ${smaller} = ?`),
    expectedAnswer: String(larger - smaller),
  };
}

export function validateManagedKeyChallengeResponse(
  response: string,
  expectedAnswer: string,
) {
  if (!response || !expectedAnswer) {
    return {
      valid: false,
      extractedNumbers: null as string[] | null,
    };
  }

  const extractedNumbers = response.match(/-?\d+/g);
  if (!extractedNumbers) {
    return {
      valid: false,
      extractedNumbers: null,
    };
  }

  return {
    valid: extractedNumbers.includes(expectedAnswer),
    extractedNumbers,
  };
}

export function buildManagedKeyChallengeFailureMessage(
  expectedAnswer: string,
  extractedNumbers: string[] | null,
) {
  const actualNumbers = extractedNumbers?.join(", ") || "(无数字)";
  return `回复验证失败：期望 ${expectedAnswer}，实际 ${actualNumbers}`;
}
