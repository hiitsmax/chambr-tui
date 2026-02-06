import crypto from "node:crypto";
import fs from "node:fs/promises";

import {
  createOpenRouterGenerator,
  type RoomTextGenerator,
  type TheatricalEvent,
} from "@chambr/engine-core";

import { CliError, EXIT_CODES } from "../cli/exit-codes";
import type {
  ChamberStateV1,
  HeadlessRunInput,
  RoomieProfileV1,
  RunHeadlessOptions,
  RunResultV1,
} from "../types/contracts";
import { CHAMBR_SCHEMA_VERSION } from "../types/contracts";
import { renderTranscript } from "../utils/events";
import { createFixtureAdapter, FixtureReplayMissError } from "./fixtures";
import { DEFAULT_BUDGET, DEFAULT_MODEL, DEFAULT_PRESET_PROMPTS } from "./constants";
import { runCoreTurn } from "./core-adapter";
import { loadChamber, resolveActiveChamberId, resolveOpenRouterApiKey, saveChamber } from "./store";

const nowIso = () => new Date().toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toRoomiesFromFile = async (filePath: string): Promise<RoomieProfileV1[]> => {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new CliError("Roomies file must be a JSON array.", {
      code: "ROOMIES_FILE_INVALID",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }

  const roomies: RoomieProfileV1[] = [];
  for (const entry of parsed) {
    if (!isRecord(entry)) continue;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const bio = typeof entry.bio === "string" ? entry.bio.trim() : "";
    if (!id || !name || !bio) continue;
    roomies.push({
      id,
      name,
      bio,
      ...(typeof entry.traits === "string" ? { traits: entry.traits } : {}),
      ...(typeof entry.model === "string" && entry.model.trim() ? { model: entry.model.trim() } : {}),
    });
  }

  if (!roomies.length) {
    throw new CliError("Roomies file did not contain any valid roomie records.", {
      code: "ROOMIES_FILE_EMPTY",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }

  return roomies;
};

const countEvents = (events: TheatricalEvent[]) => {
  const counts = { speak: 0, action: 0, thought: 0 };
  for (const event of events) {
    if (event.type === "speak") counts.speak += 1;
    if (event.type === "action") counts.action += 1;
    if (event.type === "thought") counts.thought += 1;
  }
  return counts;
};

const resolveGenerator = async (params: {
  input: HeadlessRunInput;
  baseDir?: string;
}): Promise<{ generator: RoomTextGenerator; source: "injected" | "openrouter" }> => {
  if (params.input.generateText) {
    return { generator: params.input.generateText, source: "injected" };
  }

  const apiKey = await resolveOpenRouterApiKey(params.baseDir);
  if (!apiKey) {
    throw new CliError(
      "No OpenRouter API key found. Set OPENROUTER_API_KEY or run 'chambr auth login'.",
      {
        code: "OPENROUTER_KEY_MISSING",
        exitCode: EXIT_CODES.AUTH_CONFIG,
      }
    );
  }

  return {
    generator: createOpenRouterGenerator({
      apiKey,
      logger: {
        info: () => {
          // Keep generator internals quiet by default.
        },
      },
    }),
    source: "openrouter",
  };
};

const resolveRoomies = async (params: {
  chamber: ChamberStateV1;
  roomiesFile?: string;
}): Promise<RoomieProfileV1[]> => {
  if (params.roomiesFile?.trim()) {
    return toRoomiesFromFile(params.roomiesFile.trim());
  }
  return params.chamber.roomies;
};

const buildPresetPrompt = (presetId: string) => {
  return DEFAULT_PRESET_PROMPTS[presetId] || DEFAULT_PRESET_PROMPTS.balanced;
};

const pickModelConfig = (params: {
  chamber: ChamberStateV1;
  input: HeadlessRunInput;
}) => {
  const defaultAgentModel =
    params.input.model?.trim() || params.chamber.advanced.defaultAgentModel || DEFAULT_MODEL;

  const directorModel =
    params.input.directorModel?.trim() ||
    params.chamber.advanced.directorModel ||
    defaultAgentModel;

  const summarizerModel =
    params.input.summarizerModel?.trim() ||
    params.chamber.advanced.summarizerModel ||
    defaultAgentModel;

  return {
    defaultAgentModel,
    directorModel,
    summarizerModel,
  };
};

export async function runHeadless(
  input: HeadlessRunInput,
  options: RunHeadlessOptions = {}
): Promise<RunResultV1> {
  const startedAt = nowIso();
  const startedAtMs = Date.now();
  const runId = crypto.randomUUID();

  const chamberId = await resolveActiveChamberId(input.chamberId, options.baseDir);
  const chamber = await loadChamber(chamberId, options.baseDir);
  const roomies = await resolveRoomies({ chamber, roomiesFile: input.roomiesFile });

  if (!roomies.length) {
    throw new CliError("At least one roomie is required in the chamber.", {
      code: "ROOMIES_REQUIRED",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }

  const modelConfig = pickModelConfig({ chamber, input });
  const presetId = input.presetId?.trim() || chamber.presetId || "balanced";
  const presetPrompt = buildPresetPrompt(presetId);

  const { generator } = await resolveGenerator({ input, baseDir: options.baseDir });

  const fixtureMode = input.fixtureMode || "live";
  const fixture = await createFixtureAdapter({
    mode: fixtureMode,
    fixtureName: input.fixtureName,
    baseDir: options.baseDir,
    generator,
  });

  const logToStderr = input.logToStderr ?? true;
  const events: TheatricalEvent[] = [];

  const onBeatStart = async (payload: {
    beatId: string;
    agent_id: string;
    name: string;
    step_index: number;
    intent: string;
  }) => {
    if (logToStderr) {
      process.stderr.write(
        `[beat:${payload.step_index + 1}] ${payload.name} intent=${payload.intent} (${payload.beatId})\n`
      );
    }
    if (input.onBeatStart) {
      await input.onBeatStart(payload);
    }
  };

  const onEvent = async (event: TheatricalEvent) => {
    events.push(event);
    if (logToStderr) {
      process.stderr.write(`[event:${event.type}] ${event.author}: ${event.content}\n`);
    }
    if (input.onEvent) {
      await input.onEvent(event);
    }
  };

  const beforeTurnIndex = chamber.state.shared.turn_index;

  try {
    const result = await runCoreTurn({
      chamber,
      roomies,
      input,
      modelConfig,
      budget: chamber.runtime.budget || DEFAULT_BUDGET,
      presetId,
      presetPrompt,
      generateText: fixture.generateText,
      logToStderr,
      onBeatStart,
      onEvent,
    });

    await saveChamber(chamber, options.baseDir);

    const finishedAt = nowIso();
    const durationMs = Date.now() - startedAtMs;
    const eventCounts = countEvents(result.events);

    return {
      schemaVersion: CHAMBR_SCHEMA_VERSION,
      status: "ok",
      runId,
      chamberId: chamber.id,
      mode: "headless",
      startedAt,
      finishedAt,
      durationMs,
      input: {
        prompt: input.prompt,
        presetId,
        fixtureMode,
        ...(fixture.fixtureName ? { fixtureName: fixture.fixtureName } : {}),
        roomieIds: roomies.map((roomie) => roomie.id),
        modelConfig,
      },
      output: {
        events: result.events,
        transcript: renderTranscript(result.events, { showThoughts: true }),
        directorPlan: result.directorPlan,
        stateRef: {
          chamberId: chamber.id,
          turnIndex: result.state.shared.turn_index,
        },
      },
      metrics: {
        eventCounts,
        totalEvents: result.events.length,
        directorAttempts: result.directorPlan.trace.attempts,
        directorSource: result.directorPlan.trace.source,
        turnIndexBefore: beforeTurnIndex,
        turnIndexAfter: result.state.shared.turn_index,
        latencyMs: durationMs,
      },
    };
  } catch (error) {
    if (error instanceof FixtureReplayMissError || error instanceof CliError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(message || "Run failed.", {
      code: "RUN_FAILED",
      exitCode: EXIT_CODES.PROVIDER,
    });
  }
}
