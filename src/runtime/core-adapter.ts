import {
  runRoomTurnTheatricalV3,
  type RoomTextGenerator,
  type RoomTurnInputV3,
  type TheatricalBudget,
} from "@chambr/engine-core";

import type { ChamberStateV1, HeadlessRunInput, RoomieProfileV1 } from "../types/contracts";

type ModelConfig = {
  defaultAgentModel: string;
  directorModel: string;
  summarizerModel: string;
};

type RunCoreTurnParams = {
  chamber: ChamberStateV1;
  roomies: RoomieProfileV1[];
  input: HeadlessRunInput;
  modelConfig: ModelConfig;
  budget: TheatricalBudget;
  presetId: string;
  presetPrompt: string;
  generateText: RoomTextGenerator;
  logToStderr: boolean;
  onBeatStart?: RoomTurnInputV3["onBeatStart"];
  onEvent?: RoomTurnInputV3["onEvent"];
};

const buildRoomieModelMap = (params: { roomies: RoomieProfileV1[]; defaultAgentModel: string }) => {
  return Object.fromEntries(
    params.roomies.map((roomie) => [roomie.id, roomie.model || params.defaultAgentModel])
  );
};

export async function runCoreTurn(params: RunCoreTurnParams) {
  return runRoomTurnTheatricalV3(
    {
      loadState: async () => ({ state: params.chamber.state }),
      saveState: async (_chamberId, state) => {
        params.chamber.state = state;
      },
      getModelAssignment: async () => ({
        assignment: {
          roomieModels: buildRoomieModelMap({
            roomies: params.roomies,
            defaultAgentModel: params.modelConfig.defaultAgentModel,
          }),
        },
        tier: params.input.userTier || "BASE",
        manualOverride: true,
      }),
      saveModelAssignment: async (assignmentParams) => {
        for (const roomie of params.chamber.roomies) {
          const model = assignmentParams.assignment.roomieModels[roomie.id];
          if (typeof model === "string" && model.trim()) {
            roomie.model = model.trim();
          }
        }
      },
      generateText: params.generateText,
      withTrace: async (_context, _meta, fn) => fn(),
      logger: {
        info: (_message, ...meta) => {
          if (!params.logToStderr) return;
          process.stderr.write(`[run] ${meta.map((entry) => JSON.stringify(entry)).join(" ")}\n`);
        },
        warn: (message, ...meta) => {
          if (!params.logToStderr) return;
          process.stderr.write(`[warn] ${message} ${meta.map((entry) => JSON.stringify(entry)).join(" ")}\n`);
        },
        error: (message, ...meta) => {
          if (!params.logToStderr) return;
          process.stderr.write(`[error] ${message} ${meta.map((entry) => JSON.stringify(entry)).join(" ")}\n`);
        },
      },
    },
    {
      chamberId: params.chamber.id,
      userId: params.input.userId || "local-user",
      userName: params.input.userName || "User",
      userTier: params.input.userTier || "BASE",
      userMessage: params.input.prompt,
      chamberGoal: params.chamber.goal,
      roomies: params.roomies.map((roomie) => ({
        id: roomie.id,
        name: roomie.name,
        bio: roomie.bio,
        traits: roomie.traits,
      })),
      defaultAgentModel: params.modelConfig.defaultAgentModel,
      directorModel: params.modelConfig.directorModel,
      summarizerModel: params.modelConfig.summarizerModel,
      directorReasoning: params.chamber.advanced.directorReasoning,
      defaultAgentReasoning: params.chamber.advanced.defaultAgentReasoning,
      summarizerReasoning: params.chamber.advanced.summarizerReasoning,
      budget: params.budget,
      presetId: params.presetId,
      presetPrompt: params.presetPrompt,
      thoughtDisplayDefault: params.chamber.runtime.thoughtDisplayDefault ?? true,
      maxAgents: params.chamber.runtime.maxAgents,
      compactEveryChars: params.chamber.runtime.compactEveryChars,
      compactKeepMessages: params.chamber.runtime.compactKeepMessages,
      onBeatStart: params.onBeatStart,
      onEvent: params.onEvent,
      traceContext: {
        chamberId: params.chamber.id,
        userId: params.input.userId || "local-user",
      },
    }
  );
}
