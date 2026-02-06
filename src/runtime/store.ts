import fs from "node:fs/promises";
import path from "node:path";
import { createInitialRoomState, type UserTier } from "@chambr/engine-core";

import { CliError, EXIT_CODES } from "../cli/exit-codes";
import type { ChamberStateV1, ChambrConfigV1, RoomieProfileV1 } from "../types/contracts";
import { CHAMBR_SCHEMA_VERSION } from "../types/contracts";
import { DEFAULT_CONFIG } from "./constants";
import {
  resolveBaseDir,
  resolveChamberPath,
  resolveChambersDir,
  resolveConfigPath,
  resolveFixturesDir,
} from "./paths";

const nowIso = () => new Date().toISOString();
const REASONING_SETTINGS = new Set([
  "auto",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const toTrimmed = (value: unknown, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const parseUserTier = (value: unknown): UserTier => {
  if (value === "BASE" || value === "PRO" || value === "MAX") return value;
  return "BASE";
};

const parseReasoningSetting = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const candidate = value as
    | "auto"
    | "none"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh";
  return REASONING_SETTINGS.has(candidate) ? candidate : undefined;
};

const sanitizeRoomie = (value: unknown, index: number): RoomieProfileV1 | null => {
  if (!isRecord(value)) return null;
  const id = toTrimmed(value.id, `roomie-${index + 1}`);
  const name = toTrimmed(value.name, id);
  const bio = toTrimmed(value.bio, "");
  if (!bio) return null;
  const traits = typeof value.traits === "string" ? value.traits : null;
  const model = typeof value.model === "string" && value.model.trim() ? value.model.trim() : undefined;
  return {
    id,
    name,
    bio,
    ...(traits !== null ? { traits } : {}),
    ...(model ? { model } : {}),
  };
};

const sanitizeConfig = (value: unknown): ChambrConfigV1 => {
  if (!isRecord(value)) return structuredClone(DEFAULT_CONFIG);

  const defaults = isRecord(value.defaults) ? value.defaults : {};

  return {
    schemaVersion:
      typeof value.schemaVersion === "number" && Number.isFinite(value.schemaVersion)
        ? Math.floor(value.schemaVersion)
        : CHAMBR_SCHEMA_VERSION,
    ...(typeof value.openrouterApiKey === "string" && value.openrouterApiKey.trim()
      ? { openrouterApiKey: value.openrouterApiKey.trim() }
      : {}),
    ...(typeof value.currentChamberId === "string" && value.currentChamberId.trim()
      ? { currentChamberId: value.currentChamberId.trim() }
      : {}),
    defaults: {
      userName: toTrimmed(defaults.userName, DEFAULT_CONFIG.defaults.userName),
      userTier: parseUserTier(defaults.userTier),
      presetId: toTrimmed(defaults.presetId, DEFAULT_CONFIG.defaults.presetId),
      defaultModel: toTrimmed(defaults.defaultModel, DEFAULT_CONFIG.defaults.defaultModel),
      ...(typeof defaults.directorModel === "string" && defaults.directorModel.trim()
        ? { directorModel: defaults.directorModel.trim() }
        : {}),
      ...(typeof defaults.summarizerModel === "string" && defaults.summarizerModel.trim()
        ? { summarizerModel: defaults.summarizerModel.trim() }
        : {}),
      fixtureMode:
        defaults.fixtureMode === "record" || defaults.fixtureMode === "replay"
          ? defaults.fixtureMode
          : DEFAULT_CONFIG.defaults.fixtureMode,
    },
  };
};

const sanitizeChamber = (value: unknown, chamberId: string): ChamberStateV1 => {
  if (!isRecord(value)) {
    throw new CliError(`Invalid chamber payload for '${chamberId}'.`, {
      code: "INVALID_CHAMBER_PAYLOAD",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }

  const roomiesRaw = Array.isArray(value.roomies) ? value.roomies : [];
  const roomies = roomiesRaw
    .map((entry, index) => sanitizeRoomie(entry, index))
    .filter((entry): entry is RoomieProfileV1 => Boolean(entry));

  const state = isRecord(value.state) ? value.state : createInitialRoomState();

  const advanced = isRecord(value.advanced) ? value.advanced : {};
  const runtime = isRecord(value.runtime) ? value.runtime : {};

  return {
    schemaVersion:
      typeof value.schemaVersion === "number" && Number.isFinite(value.schemaVersion)
        ? Math.floor(value.schemaVersion)
        : CHAMBR_SCHEMA_VERSION,
    id: toTrimmed(value.id, chamberId),
    name: toTrimmed(value.name, chamberId),
    goal: typeof value.goal === "string" ? value.goal : "",
    presetId: toTrimmed(value.presetId, DEFAULT_CONFIG.defaults.presetId),
    createdAt: toTrimmed(value.createdAt, nowIso()),
    updatedAt: toTrimmed(value.updatedAt, nowIso()),
    roomies,
    advanced: {
      ...(typeof advanced.defaultAgentModel === "string" && advanced.defaultAgentModel.trim()
        ? { defaultAgentModel: advanced.defaultAgentModel.trim() }
        : {}),
      ...(typeof advanced.directorModel === "string" && advanced.directorModel.trim()
        ? { directorModel: advanced.directorModel.trim() }
        : {}),
      ...(typeof advanced.summarizerModel === "string" && advanced.summarizerModel.trim()
        ? { summarizerModel: advanced.summarizerModel.trim() }
        : {}),
      ...(parseReasoningSetting(advanced.directorReasoning)
        ? { directorReasoning: parseReasoningSetting(advanced.directorReasoning) }
        : {}),
      ...(parseReasoningSetting(advanced.defaultAgentReasoning)
        ? { defaultAgentReasoning: parseReasoningSetting(advanced.defaultAgentReasoning) }
        : {}),
      ...(parseReasoningSetting(advanced.summarizerReasoning)
        ? { summarizerReasoning: parseReasoningSetting(advanced.summarizerReasoning) }
        : {}),
    },
    runtime: {
      ...(isRecord(runtime.budget) ? { budget: runtime.budget as ChamberStateV1["runtime"]["budget"] } : {}),
      ...(typeof runtime.thoughtDisplayDefault === "boolean"
        ? { thoughtDisplayDefault: runtime.thoughtDisplayDefault }
        : {}),
      ...(typeof runtime.maxAgents === "number" && Number.isFinite(runtime.maxAgents)
        ? { maxAgents: Math.max(1, Math.floor(runtime.maxAgents)) }
        : {}),
      ...(typeof runtime.compactEveryChars === "number" && Number.isFinite(runtime.compactEveryChars)
        ? { compactEveryChars: Math.max(0, Math.floor(runtime.compactEveryChars)) }
        : {}),
      ...(typeof runtime.compactKeepMessages === "number" && Number.isFinite(runtime.compactKeepMessages)
        ? { compactKeepMessages: Math.max(0, Math.floor(runtime.compactKeepMessages)) }
        : {}),
    },
    state: state as ChamberStateV1["state"],
  };
};

const readJsonFile = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf8");
  return safeJsonParse(raw);
};

const writeJsonFile = async (filePath: string, value: unknown, mode?: number) => {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode,
  });
  if (mode !== undefined) {
    try {
      await fs.chmod(filePath, mode);
    } catch {
      // Ignore chmod failures on unsupported platforms/filesystems.
    }
  }
};

export async function ensureStorage(baseDir?: string) {
  const root = resolveBaseDir(baseDir);
  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(resolveChambersDir(baseDir), { recursive: true });
  await fs.mkdir(resolveFixturesDir(baseDir), { recursive: true });
  return root;
}

export async function loadConfig(baseDir?: string): Promise<ChambrConfigV1> {
  await ensureStorage(baseDir);
  const filePath = resolveConfigPath(baseDir);

  try {
    const parsed = await readJsonFile(filePath);
    return sanitizeConfig(parsed);
  } catch {
    const fallback = structuredClone(DEFAULT_CONFIG);
    await saveConfig(fallback, baseDir);
    return fallback;
  }
}

export async function saveConfig(config: ChambrConfigV1, baseDir?: string): Promise<void> {
  await ensureStorage(baseDir);
  const filePath = resolveConfigPath(baseDir);
  const sanitized = sanitizeConfig(config);
  await writeJsonFile(filePath, sanitized, 0o600);
}

export async function updateConfig(
  updater: (current: ChambrConfigV1) => ChambrConfigV1,
  baseDir?: string
): Promise<ChambrConfigV1> {
  const current = await loadConfig(baseDir);
  const next = updater(current);
  await saveConfig(next, baseDir);
  return loadConfig(baseDir);
}

export async function resolveOpenRouterApiKey(baseDir?: string): Promise<string | null> {
  const fromEnv = process.env.OPENROUTER_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const config = await loadConfig(baseDir);
  if (config.openrouterApiKey?.trim()) return config.openrouterApiKey.trim();
  return null;
}

export async function createChamber(params: {
  id: string;
  name: string;
  goal?: string;
  presetId?: string;
}, baseDir?: string): Promise<ChamberStateV1> {
  const now = nowIso();
  const chamber: ChamberStateV1 = {
    schemaVersion: CHAMBR_SCHEMA_VERSION,
    id: params.id,
    name: params.name,
    goal: params.goal || "",
    presetId: params.presetId || DEFAULT_CONFIG.defaults.presetId,
    createdAt: now,
    updatedAt: now,
    roomies: [],
    advanced: {},
    runtime: {},
    state: createInitialRoomState(),
  };

  await saveChamber(chamber, baseDir);
  return chamber;
}

export async function loadChamber(chamberId: string, baseDir?: string): Promise<ChamberStateV1> {
  if (!chamberId.trim()) {
    throw new CliError("A chamber id is required.", {
      code: "CHAMBER_ID_REQUIRED",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }

  const filePath = resolveChamberPath(chamberId.trim(), baseDir);
  try {
    const parsed = await readJsonFile(filePath);
    return sanitizeChamber(parsed, chamberId.trim());
  } catch {
    throw new CliError(`Chamber '${chamberId}' was not found.`, {
      code: "CHAMBER_NOT_FOUND",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }
}

export async function saveChamber(chamber: ChamberStateV1, baseDir?: string): Promise<void> {
  await ensureStorage(baseDir);
  const id = chamber.id.trim();
  if (!id) {
    throw new CliError("Cannot save chamber without a valid id.", {
      code: "CHAMBER_ID_INVALID",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }

  const filePath = resolveChamberPath(id, baseDir);
  const payload: ChamberStateV1 = {
    ...chamber,
    schemaVersion: CHAMBR_SCHEMA_VERSION,
    updatedAt: nowIso(),
  };
  await writeJsonFile(filePath, payload);
}

export async function listChambers(baseDir?: string): Promise<ChamberStateV1[]> {
  await ensureStorage(baseDir);
  const directory = resolveChambersDir(baseDir);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));

  const chambers: ChamberStateV1[] = [];
  for (const file of files) {
    const id = file.name.replace(/\.json$/i, "");
    try {
      const chamber = await loadChamber(id, baseDir);
      chambers.push(chamber);
    } catch {
      // Skip invalid files.
    }
  }

  chambers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return chambers;
}

export async function setCurrentChamber(chamberId: string, baseDir?: string): Promise<void> {
  await updateConfig(
    (current) => ({
      ...current,
      currentChamberId: chamberId,
    }),
    baseDir
  );
}

export async function getCurrentChamberId(baseDir?: string): Promise<string | null> {
  const config = await loadConfig(baseDir);
  return config.currentChamberId?.trim() || null;
}

export async function resolveActiveChamberId(explicitId: string | undefined, baseDir?: string): Promise<string> {
  if (explicitId?.trim()) return explicitId.trim();
  const current = await getCurrentChamberId(baseDir);
  if (current) return current;
  throw new CliError("No active chamber selected. Use 'chamber use <id>' or pass --chamber.", {
    code: "NO_ACTIVE_CHAMBER",
    exitCode: EXIT_CODES.VALIDATION,
  });
}

export async function resetChamberState(chamberId: string, baseDir?: string): Promise<ChamberStateV1> {
  const chamber = await loadChamber(chamberId, baseDir);
  chamber.state = createInitialRoomState();
  await saveChamber(chamber, baseDir);
  return loadChamber(chamberId, baseDir);
}
