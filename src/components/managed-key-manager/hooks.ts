import { useState } from "react";

export function useRepairFormState() {
  const [repairInput, setRepairInput] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("repair_key") || "" : ""
  );
  const [repairBaseUrl, setRepairBaseUrl] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("repair_baseUrl") || "https://new.timefiles.online" : "https://new.timefiles.online"
  );
  const [repairProtocol, setRepairProtocol] = useState<"anthropic" | "openai">(() =>
    typeof window !== "undefined" ? (localStorage.getItem("repair_protocol") as "anthropic" | "openai") || "anthropic" : "anthropic"
  );
  const [repairKeyId, setRepairKeyId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("repair_keyId") || "" : ""
  );
  const [repairModel, setRepairModel] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("repair_model") || "" : ""
  );
  const [repairCustomPrompt, setRepairCustomPrompt] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("repair_customPrompt") || "" : ""
  );
  const [repairMaxCandidates, setRepairMaxCandidates] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("repair_maxCandidates") || "50" : "50"
  );

  return {
    repairInput,
    setRepairInput,
    repairBaseUrl,
    setRepairBaseUrl,
    repairProtocol,
    setRepairProtocol,
    repairKeyId,
    setRepairKeyId,
    repairModel,
    setRepairModel,
    repairCustomPrompt,
    setRepairCustomPrompt,
    repairMaxCandidates,
    setRepairMaxCandidates,
  };
}
