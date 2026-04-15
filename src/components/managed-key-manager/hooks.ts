import { useState } from "react";

export function useRepairFormState() {
  const [repairInput, setRepairInput] = useState(() => localStorage.getItem("repair_key") || "");
  const [repairBaseUrl, setRepairBaseUrl] = useState(() => localStorage.getItem("repair_baseUrl") || "https://new.timefiles.online");
  const [repairProtocol, setRepairProtocol] = useState<"anthropic" | "openai">(() => (localStorage.getItem("repair_protocol") as "anthropic" | "openai") || "anthropic");
  const [repairKeyId, setRepairKeyId] = useState(() => localStorage.getItem("repair_keyId") || "");
  const [repairModel, setRepairModel] = useState(() => localStorage.getItem("repair_model") || "");
  const [repairCustomPrompt, setRepairCustomPrompt] = useState(() => localStorage.getItem("repair_customPrompt") || "");
  const [repairMaxCandidates, setRepairMaxCandidates] = useState(() => localStorage.getItem("repair_maxCandidates") || "50");

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
