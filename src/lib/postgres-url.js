export function normalizePostgresSslMode(url) {
  if (!url || !/^postgres(ql)?:\/\//i.test(url)) {
    return url;
  }

  const parsed = new URL(url);
  const sslMode = parsed.searchParams.get("sslmode");
  const usesLibpqCompat = parsed.searchParams.get("uselibpqcompat");

  if (!sslMode || usesLibpqCompat === "true") {
    return parsed.toString();
  }

  if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
    parsed.searchParams.set("uselibpqcompat", "true");
  }

  return parsed.toString();
}
