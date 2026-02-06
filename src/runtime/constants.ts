import type { TheatricalBudget, UserTier } from "@chambr/engine-core";

import type { ChambrConfigV1 } from "../types/contracts";

export const DEFAULT_MODEL = "anthropic/claude-3.7-sonnet";

export const DEFAULT_PRESET_PROMPTS: Record<string, string> = {
  balanced:
    "Balanced dramatic tone. Keep events sparse. Prioritize clear decisions and grounded interactions.",
  sitcom:
    "Playful ensemble rhythm. Use occasional punchy actions and meaningful short voiceover thoughts.",
  debate:
    "High-friction intellectual debate. Emphasize argument moves, rebuttals, and strategic interruptions.",
  strategic:
    "Deliberate strategic room. Focus on options, tradeoffs, and decisive coordination beats.",
};

export const DEFAULT_BUDGET: TheatricalBudget = {
  maxDirectorAttempts: 2,
  maxActionEventsPerTurn: 2,
  maxThoughtEventsPerTurn: 2,
  maxThoughtCharsPerEvent: 220,
  targetP95TurnLatencyMs: 10000,
};

export const DEFAULT_CONFIG: ChambrConfigV1 = {
  schemaVersion: 1,
  defaults: {
    userName: "User",
    userTier: "BASE" as UserTier,
    presetId: "balanced",
    defaultModel: DEFAULT_MODEL,
    fixtureMode: "live",
  },
};

export const DEFAULT_FIXTURE_NAME = "default";
