import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createChamber,
  getCurrentChamberId,
  listChambers,
  loadChamber,
  loadConfig,
  saveChamber,
  saveConfig,
  setCurrentChamber,
} from "./store";

const tempDirs: string[] = [];

const makeTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "chambr-tui-store-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    })
  );
});

describe("store", () => {
  it("creates default config when missing", async () => {
    const baseDir = await makeTempDir();
    const config = await loadConfig(baseDir);
    expect(config.defaults.presetId).toBe("balanced");
    expect(config.defaults.userTier).toBe("BASE");
  });

  it("saves and reloads current chamber id", async () => {
    const baseDir = await makeTempDir();
    const config = await loadConfig(baseDir);
    await saveConfig({
      ...config,
      currentChamberId: "abc123",
    }, baseDir);

    expect(await getCurrentChamberId(baseDir)).toBe("abc123");
  });

  it("creates, saves and lists chambers", async () => {
    const baseDir = await makeTempDir();
    const chamber = await createChamber({
      id: "test-chamber",
      name: "Test Chamber",
      goal: "Ship the CLI",
      presetId: "balanced",
    }, baseDir);

    chamber.goal = "Ship fast";
    await saveChamber(chamber, baseDir);

    const loaded = await loadChamber("test-chamber", baseDir);
    expect(loaded.goal).toBe("Ship fast");

    await setCurrentChamber("test-chamber", baseDir);
    expect(await getCurrentChamberId(baseDir)).toBe("test-chamber");

    const list = await listChambers(baseDir);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("test-chamber");
  });
});
