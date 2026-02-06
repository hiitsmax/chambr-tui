import crypto from "node:crypto";
import fs from "node:fs/promises";

import type { RoomTextGenerator, RoomTextRequest } from "@chambr/engine-core";

import { CliError, EXIT_CODES } from "../cli/exit-codes";
import type { FixtureFileV1, FixtureMode } from "../types/contracts";
import { CHAMBR_SCHEMA_VERSION } from "../types/contracts";
import { DEFAULT_FIXTURE_NAME } from "./constants";
import { ensureStorage } from "./store";
import { normalizeFixtureName, resolveFixturePath } from "./paths";

const nowIso = () => new Date().toISOString();

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(String(value));
};

const normalizeRequestForFixture = (request: RoomTextRequest) => ({
  model: request.model,
  system: request.system,
  prompt: request.prompt,
  messages: request.messages,
  temperature: request.temperature,
  reasoningEffort: request.reasoningEffort,
});

export const hashFixtureRequest = (request: RoomTextRequest) => {
  const normalized = normalizeRequestForFixture(request);
  return crypto.createHash("sha256").update(stableStringify(normalized)).digest("hex");
};

const defaultFixtureFile = (name: string): FixtureFileV1 => {
  const now = nowIso();
  return {
    schemaVersion: CHAMBR_SCHEMA_VERSION,
    name,
    createdAt: now,
    updatedAt: now,
    entries: {},
  };
};

const loadFixtureFileRaw = async (name: string, baseDir?: string): Promise<FixtureFileV1 | null> => {
  const fixtureName = normalizeFixtureName(name || DEFAULT_FIXTURE_NAME);
  const filePath = resolveFixturePath(fixtureName, baseDir);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as FixtureFileV1;
    if (!parsed || typeof parsed !== "object" || typeof parsed.entries !== "object") {
      return null;
    }
    return {
      schemaVersion:
        typeof parsed.schemaVersion === "number" && Number.isFinite(parsed.schemaVersion)
          ? Math.floor(parsed.schemaVersion)
          : CHAMBR_SCHEMA_VERSION,
      name: parsed.name || fixtureName,
      createdAt: parsed.createdAt || nowIso(),
      updatedAt: parsed.updatedAt || nowIso(),
      entries: parsed.entries || {},
    };
  } catch {
    return null;
  }
};

const saveFixtureFile = async (fixture: FixtureFileV1, baseDir?: string) => {
  await ensureStorage(baseDir);
  const fixtureName = normalizeFixtureName(fixture.name || DEFAULT_FIXTURE_NAME);
  const filePath = resolveFixturePath(fixtureName, baseDir);
  const payload: FixtureFileV1 = {
    ...fixture,
    schemaVersion: CHAMBR_SCHEMA_VERSION,
    name: fixtureName,
    updatedAt: nowIso(),
  };
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

export class FixtureReplayMissError extends CliError {
  constructor(params: { fixtureName: string; hash: string }) {
    super(
      `Fixture replay miss for '${params.fixtureName}' (hash=${params.hash.slice(0, 12)}).`,
      {
        code: "FIXTURE_REPLAY_MISS",
        exitCode: EXIT_CODES.FIXTURE_REPLAY_MISS,
      }
    );
    this.name = "FixtureReplayMissError";
  }
}

export async function createFixtureAdapter(params: {
  mode: FixtureMode;
  fixtureName?: string;
  baseDir?: string;
  generator: RoomTextGenerator;
}): Promise<{ mode: FixtureMode; fixtureName?: string; generateText: RoomTextGenerator }> {
  const mode = params.mode;
  if (mode === "live") {
    return {
      mode,
      generateText: params.generator,
    };
  }

  const fixtureName = normalizeFixtureName(params.fixtureName || DEFAULT_FIXTURE_NAME);
  const existing = await loadFixtureFileRaw(fixtureName, params.baseDir);

  if (mode === "replay") {
    const fixture = existing;
    if (!fixture) {
      throw new CliError(`Fixture '${fixtureName}' was not found for replay mode.`, {
        code: "FIXTURE_NOT_FOUND",
        exitCode: EXIT_CODES.FIXTURE_REPLAY_MISS,
      });
    }

    return {
      mode,
      fixtureName,
      generateText: async (request) => {
        const hash = hashFixtureRequest(request);
        const entry = fixture.entries[hash];
        if (!entry) {
          throw new FixtureReplayMissError({ fixtureName, hash });
        }
        return entry.response;
      },
    };
  }

  const fixture = existing || defaultFixtureFile(fixtureName);

  return {
    mode,
    fixtureName,
    generateText: async (request: RoomTextRequest) => {
      const hash = hashFixtureRequest(request);
      const response = await params.generator(request);
      fixture.entries[hash] = {
        hash,
        createdAt: fixture.entries[hash]?.createdAt || nowIso(),
        request: normalizeRequestForFixture(request) as RoomTextRequest,
        response,
      };
      await saveFixtureFile(fixture, params.baseDir);
      return response;
    },
  };
}

export async function loadFixture(baseDir: string | undefined, fixtureName: string) {
  return loadFixtureFileRaw(fixtureName, baseDir);
}

export async function recordFixture(params: {
  request: RoomTextRequest;
  response: string;
  fixtureName?: string;
  baseDir?: string;
}) {
  const fixtureName = normalizeFixtureName(params.fixtureName || DEFAULT_FIXTURE_NAME);
  const fixture = (await loadFixtureFileRaw(fixtureName, params.baseDir)) || defaultFixtureFile(fixtureName);
  const hash = hashFixtureRequest(params.request);
  fixture.entries[hash] = {
    hash,
    createdAt: fixture.entries[hash]?.createdAt || nowIso(),
    request: normalizeRequestForFixture(params.request) as RoomTextRequest,
    response: params.response,
  };
  await saveFixtureFile(fixture, params.baseDir);
  return fixture.entries[hash];
}

export async function replayFixture(params: {
  request: RoomTextRequest;
  fixtureName?: string;
  baseDir?: string;
}) {
  const fixtureName = normalizeFixtureName(params.fixtureName || DEFAULT_FIXTURE_NAME);
  const fixture = await loadFixtureFileRaw(fixtureName, params.baseDir);
  if (!fixture) {
    throw new CliError(`Fixture '${fixtureName}' was not found for replay mode.`, {
      code: "FIXTURE_NOT_FOUND",
      exitCode: EXIT_CODES.FIXTURE_REPLAY_MISS,
    });
  }
  const hash = hashFixtureRequest(params.request);
  const entry = fixture.entries[hash];
  if (!entry) {
    throw new FixtureReplayMissError({ fixtureName, hash });
  }
  return entry.response;
}
