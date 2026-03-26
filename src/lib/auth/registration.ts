function parseBooleanEnv(value: string | undefined, defaultValue: boolean) {
  if (!value) return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  return defaultValue;
}

export function isInviteCodeRequiredForRegistration() {
  return parseBooleanEnv(process.env.AUTH_REQUIRE_INVITE_CODE, false);
}
