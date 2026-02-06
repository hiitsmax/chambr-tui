import os from "node:os";
import path from "node:path";

const BASE_DIR_ENV = "CHAMBR_HOME";

export const resolveBaseDir = (baseDir?: string) => {
  if (baseDir) return path.resolve(baseDir);
  const fromEnv = process.env[BASE_DIR_ENV];
  if (fromEnv && fromEnv.trim()) {
    return path.resolve(fromEnv.trim());
  }
  return path.join(os.homedir(), ".chambr");
};

export const resolveConfigPath = (baseDir?: string) => path.join(resolveBaseDir(baseDir), "config.json");

export const resolveChambersDir = (baseDir?: string) => path.join(resolveBaseDir(baseDir), "chambers");

export const resolveChamberPath = (chamberId: string, baseDir?: string) =>
  path.join(resolveChambersDir(baseDir), `${chamberId}.json`);

export const resolveFixturesDir = (baseDir?: string) => path.join(resolveBaseDir(baseDir), "fixtures");

export const normalizeFixtureName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return "default";
  return trimmed.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "default";
};

export const resolveFixturePath = (name: string, baseDir?: string) =>
  path.join(resolveFixturesDir(baseDir), `${normalizeFixtureName(name)}.json`);
