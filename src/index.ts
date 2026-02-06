export type {
  ChamberStateV1,
  ChambrConfigV1,
  FixtureFileV1,
  FixtureMode,
  HeadlessRunInput,
  RoomieProfileV1,
  RunResultV1,
} from "./types/contracts";

export {
  ensureStorage,
  loadConfig,
  saveConfig,
  updateConfig,
  resolveOpenRouterApiKey,
  loadChamber,
  saveChamber,
  listChambers,
  setCurrentChamber,
  getCurrentChamberId,
  resolveActiveChamberId,
  createChamber,
  resetChamberState,
} from "./runtime/store";

export {
  createChamberRecord,
  listChamberRecords,
  useChamberRecord,
  getActiveChamber,
  resetChamberRecord,
  addRoomieToChamber,
  listRoomiesInChamber,
  setRoomieModelInChamber,
  listRoomieModelsInChamber,
  setDirectorModelInChamber,
} from "./runtime/chamber-service";

export { authLogin, authLogout, authStatus } from "./runtime/auth-service";

export {
  createFixtureAdapter,
  hashFixtureRequest,
  loadFixture,
  recordFixture,
  replayFixture,
  FixtureReplayMissError,
} from "./runtime/fixtures";

export { runHeadless } from "./runtime/run";

export { parseEventNdjson, renderEventLine, renderTranscript } from "./utils/events";
