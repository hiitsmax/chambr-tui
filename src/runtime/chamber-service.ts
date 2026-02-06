import crypto from "node:crypto";

import { CliError, EXIT_CODES } from "../cli/exit-codes";
import type { ChamberStateV1, RoomieProfileV1 } from "../types/contracts";
import { DEFAULT_CONFIG, DEFAULT_MODEL } from "./constants";
import {
  createChamber,
  getCurrentChamberId,
  listChambers,
  loadChamber,
  resetChamberState,
  resolveActiveChamberId,
  saveChamber,
  setCurrentChamber,
} from "./store";

const toId = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const roomieIdFromName = (name: string) => {
  const slug = toId(name);
  if (slug) return slug;
  return `roomie-${crypto.randomUUID().slice(0, 8)}`;
};

export async function createChamberRecord(params: {
  name?: string;
  goal?: string;
  presetId?: string;
  id?: string;
  baseDir?: string;
}) {
  const chamberId = params.id?.trim() || crypto.randomUUID().slice(0, 12);
  const chamberName = params.name?.trim() || `Chamber ${chamberId.slice(0, 6)}`;
  const chamber = await createChamber(
    {
      id: chamberId,
      name: chamberName,
      goal: params.goal || "",
      presetId: params.presetId || DEFAULT_CONFIG.defaults.presetId,
    },
    params.baseDir
  );
  await setCurrentChamber(chamber.id, params.baseDir);
  return chamber;
}

export async function listChamberRecords(baseDir?: string) {
  return listChambers(baseDir);
}

export async function useChamberRecord(chamberId: string, baseDir?: string) {
  const chamber = await loadChamber(chamberId, baseDir);
  await setCurrentChamber(chamber.id, baseDir);
  return chamber;
}

export async function getActiveChamber(baseDir?: string) {
  const chamberId = await getCurrentChamberId(baseDir);
  if (!chamberId) return null;
  return loadChamber(chamberId, baseDir);
}

export async function resetChamberRecord(chamberId: string | undefined, baseDir?: string) {
  const resolved = await resolveActiveChamberId(chamberId, baseDir);
  return resetChamberState(resolved, baseDir);
}

const sortRoomies = (roomies: RoomieProfileV1[]) => {
  return [...roomies].sort((a, b) => a.name.localeCompare(b.name));
};

const findRoomie = (chamber: ChamberStateV1, roomieId: string) => {
  return chamber.roomies.find((roomie) => roomie.id === roomieId);
};

export async function addRoomieToChamber(params: {
  chamberId?: string;
  name: string;
  bio: string;
  id?: string;
  model?: string;
  traits?: string;
  baseDir?: string;
}) {
  const chamberId = await resolveActiveChamberId(params.chamberId, params.baseDir);
  const chamber = await loadChamber(chamberId, params.baseDir);

  const name = params.name.trim();
  const bio = params.bio.trim();
  if (!name || !bio) {
    throw new CliError("Both roomie name and bio are required.", {
      code: "ROOMIE_REQUIRED_FIELDS",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }

  const roomieId = params.id?.trim() || roomieIdFromName(name);
  if (findRoomie(chamber, roomieId)) {
    throw new CliError(`Roomie '${roomieId}' already exists in chamber '${chamber.id}'.`, {
      code: "ROOMIE_ALREADY_EXISTS",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }

  chamber.roomies.push({
    id: roomieId,
    name,
    bio,
    ...(params.traits ? { traits: params.traits } : {}),
    ...(params.model ? { model: params.model.trim() } : {}),
  });

  if (!chamber.advanced.defaultAgentModel) {
    chamber.advanced.defaultAgentModel = DEFAULT_MODEL;
  }

  chamber.roomies = sortRoomies(chamber.roomies);
  await saveChamber(chamber, params.baseDir);
  return loadChamber(chamber.id, params.baseDir);
}

export async function listRoomiesInChamber(params: { chamberId?: string; baseDir?: string }) {
  const chamberId = await resolveActiveChamberId(params.chamberId, params.baseDir);
  const chamber = await loadChamber(chamberId, params.baseDir);
  return sortRoomies(chamber.roomies);
}

export async function setRoomieModelInChamber(params: {
  chamberId?: string;
  roomieId: string;
  model: string;
  baseDir?: string;
}) {
  const chamberId = await resolveActiveChamberId(params.chamberId, params.baseDir);
  const chamber = await loadChamber(chamberId, params.baseDir);
  const roomie = findRoomie(chamber, params.roomieId.trim());

  if (!roomie) {
    throw new CliError(`Roomie '${params.roomieId}' not found in chamber '${chamber.id}'.`, {
      code: "ROOMIE_NOT_FOUND",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }

  const model = params.model.trim();
  if (!model) {
    throw new CliError("Model is required.", {
      code: "MODEL_REQUIRED",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }

  roomie.model = model;
  await saveChamber(chamber, params.baseDir);
  return loadChamber(chamber.id, params.baseDir);
}

export async function listRoomieModelsInChamber(params: { chamberId?: string; baseDir?: string }) {
  const chamberId = await resolveActiveChamberId(params.chamberId, params.baseDir);
  const chamber = await loadChamber(chamberId, params.baseDir);
  const defaultModel = chamber.advanced.defaultAgentModel || DEFAULT_MODEL;

  return sortRoomies(chamber.roomies).map((roomie) => ({
    roomieId: roomie.id,
    roomieName: roomie.name,
    model: roomie.model || defaultModel,
    inherited: !roomie.model,
  }));
}

export async function setDirectorModelInChamber(params: {
  chamberId?: string;
  directorModel: string;
  baseDir?: string;
}) {
  const chamberId = await resolveActiveChamberId(params.chamberId, params.baseDir);
  const chamber = await loadChamber(chamberId, params.baseDir);
  const directorModel = params.directorModel.trim();

  if (!directorModel) {
    throw new CliError("Director model is required.", {
      code: "DIRECTOR_MODEL_REQUIRED",
      exitCode: EXIT_CODES.VALIDATION,
    });
  }

  chamber.advanced.directorModel = directorModel;
  await saveChamber(chamber, params.baseDir);
  return loadChamber(chamber.id, params.baseDir);
}
