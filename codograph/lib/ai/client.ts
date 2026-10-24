import OpenAI from "openai";
import { wrapOpenAI } from "langsmith/wrappers/openai";

// The one place the AI client is constructed. A client built anywhere else
// would work and silently go untraced, so nothing else imports "openai".

// Exact snapshots, never a moving alias: an alias changes the model under a
// cached answer without changing its key. Each model is part of its own
// tasks' cache keys, so re-pinning one invalidates only its own answers, and
// switching provider never serves one provider's answer as the other's.
const OPENAI_MODELS = {
  explain: "gpt-5.5-2026-04-23",
  classify: "gpt-5.4-mini-2026-03-17",
} as const;

// NVIDIA's free hosted NIM endpoint, used only when there's no OpenAI key.
// NIM ids name one fixed checkpoint, so they're as stable as a snapshot.
const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";
// meta/llama-3.3-70b-instruct was retired on 2026-08-26. Of the models a free
// account can actually call, this one answers in well under a second with its
// thinking switched off (see tasks.ts), and keeps to a JSON schema.
const NIM_MODELS = {
  explain: "nvidia/nemotron-3.5-lightning-30b-a3b",
  classify: "nvidia/nemotron-3.5-lightning-30b-a3b",
} as const;

export type Provider = {
  name: "openai" | "nvidia-nim";
  client: OpenAI;
  models: { explain: string; classify: string };
};

export type TracingStatus = { on: true; project: string } | { on: false; reason: string };

// An absent key looks exactly like a working setup with no traffic, so the
// state is reported with every answer instead of being inferred.
export function tracingStatus(): TracingStatus {
  if (process.env.LANGSMITH_TRACING?.trim() !== "true") return { on: false, reason: "LANGSMITH_TRACING isn't \"true\"" };
  if (!process.env.LANGSMITH_API_KEY?.trim()) return { on: false, reason: "LANGSMITH_API_KEY isn't set" };
  return { on: true, project: process.env.LANGSMITH_PROJECT?.trim() || "default" };
}

let provider: Provider | null = null;

// Built on first use rather than at import, so a missing key fails the call
// that needed it with a message saying so, not the server's boot. OpenAI wins
// when its key is set; NIM is the fallback, never a second attempt after an
// OpenAI call fails.
export function ai(): Provider {
  if (provider) return provider;
  const tracing = { tracingEnabled: tracingStatus().on };
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();
  if (openaiKey) {
    provider = { name: "openai", client: wrapOpenAI(new OpenAI({ apiKey: openaiKey }), tracing), models: OPENAI_MODELS };
  } else if (nvidiaKey) {
    provider = { name: "nvidia-nim", client: wrapOpenAI(new OpenAI({ apiKey: nvidiaKey, baseURL: NIM_BASE_URL }), tracing), models: NIM_MODELS };
  } else {
    throw new Error("Neither OPENAI_API_KEY nor NVIDIA_API_KEY is set in .env.local, so nothing can be explained");
  }
  return provider;
}

/**
 * How every traced step is recorded. Whatever runs inside it, the cache read
 * included, is one run, so a cache hit shows up as a run with no model call
 * under it. With tracing off the function runs exactly the same, untraced.
 */
export function traceConfig(name: string) {
  return { name, run_type: "chain", tracingEnabled: tracingStatus().on } as const;
}
