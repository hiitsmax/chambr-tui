import type {
  DirectorPlan,
  ReasoningEffortSetting,
  RoomState,
  RoomTextGenerator,
  RoomTextRequest,
  TheatricalBudget,
  TheatricalEvent,
  UserTier,
} from "@chambr/engine-core";

export const CHAMBR_SCHEMA_VERSION = 1;

export type FixtureMode = "live" | "record" | "replay";

export type ChambrDefaultsV1 = {
  userName: string;
  userTier: UserTier;
  presetId: string;
  defaultModel: string;
  directorModel?: string;
  summarizerModel?: string;
  fixtureMode: FixtureMode;
};

export type ChambrConfigV1 = {
  schemaVersion: number;
  openrouterApiKey?: string;
  currentChamberId?: string;
  defaults: ChambrDefaultsV1;
};

export type RoomieProfileV1 = {
  id: string;
  name: string;
  bio: string;
  traits?: string | null;
  model?: string;
};

export type ChamberAdvancedV1 = {
  defaultAgentModel?: string;
  directorModel?: string;
  summarizerModel?: string;
  directorReasoning?: ReasoningEffortSetting;
  defaultAgentReasoning?: ReasoningEffortSetting;
  summarizerReasoning?: ReasoningEffortSetting;
};

export type ChamberRuntimeV1 = {
  budget?: TheatricalBudget;
  thoughtDisplayDefault?: boolean;
  maxAgents?: number;
  compactEveryChars?: number;
  compactKeepMessages?: number;
};

export type ChamberStateV1 = {
  schemaVersion: number;
  id: string;
  name: string;
  goal: string;
  presetId: string;
  createdAt: string;
  updatedAt: string;
  roomies: RoomieProfileV1[];
  advanced: ChamberAdvancedV1;
  runtime: ChamberRuntimeV1;
  state: RoomState;
};

export type FixtureEntryV1 = {
  hash: string;
  createdAt: string;
  request: RoomTextRequest;
  response: string;
};

export type FixtureFileV1 = {
  schemaVersion: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  entries: Record<string, FixtureEntryV1>;
};

export type HeadlessRunInput = {
  prompt: string;
  chamberId?: string;
  userId?: string;
  userName?: string;
  userTier?: UserTier;
  presetId?: string;
  model?: string;
  directorModel?: string;
  summarizerModel?: string;
  fixtureMode?: FixtureMode;
  fixtureName?: string;
  roomiesFile?: string;
  logToStderr?: boolean;
  generateText?: RoomTextGenerator;
  onEvent?: (event: TheatricalEvent) => void | Promise<void>;
  onBeatStart?: (payload: {
    beatId: string;
    agent_id: string;
    name: string;
    step_index: number;
    intent: string;
  }) => void | Promise<void>;
};

export type RunInputSummaryV1 = {
  prompt: string;
  presetId: string;
  fixtureMode: FixtureMode;
  fixtureName?: string;
  roomieIds: string[];
  modelConfig: {
    defaultAgentModel: string;
    directorModel: string;
    summarizerModel: string;
  };
};

export type RunMetricsV1 = {
  eventCounts: {
    speak: number;
    action: number;
    thought: number;
  };
  totalEvents: number;
  directorAttempts: number;
  directorSource: DirectorPlan["trace"]["source"];
  turnIndexBefore: number;
  turnIndexAfter: number;
  latencyMs: number;
};

export type RunOutputV1 = {
  events: TheatricalEvent[];
  transcript: string;
  directorPlan: DirectorPlan;
  stateRef: {
    chamberId: string;
    turnIndex: number;
  };
};

export type RunResultV1 = {
  schemaVersion: number;
  status: "ok" | "error";
  runId: string;
  chamberId: string;
  mode: "headless";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  input: RunInputSummaryV1;
  output?: RunOutputV1;
  metrics?: RunMetricsV1;
  error?: {
    code: string;
    message: string;
  };
};

export type RunHeadlessOptions = {
  baseDir?: string;
};

export type FixtureLookup = {
  request: RoomTextRequest;
  hash: string;
};

export type FixtureAdapter = {
  mode: FixtureMode;
  fixtureName?: string;
  generateText: RoomTextGenerator;
};
