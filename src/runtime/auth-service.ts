import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { updateConfig, loadConfig } from "./store";

export async function authLogin(params: { key?: string; baseDir?: string }) {
  let key = params.key?.trim();
  if (!key) {
    const rl = readline.createInterface({ input, output, terminal: true });
    try {
      key = (await rl.question("OpenRouter API key: ")).trim();
    } finally {
      rl.close();
    }
  }

  if (!key) {
    throw new Error("No API key provided.");
  }

  await updateConfig(
    (current) => ({
      ...current,
      openrouterApiKey: key,
    }),
    params.baseDir
  );

  return { saved: true };
}

export async function authLogout(params: { baseDir?: string }) {
  await updateConfig(
    (current) => {
      const next = { ...current };
      delete next.openrouterApiKey;
      return next;
    },
    params.baseDir
  );

  return { cleared: true };
}

export async function authStatus(params: { baseDir?: string }) {
  const config = await loadConfig(params.baseDir);
  const hasEnv = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const hasStored = Boolean(config.openrouterApiKey?.trim());

  return {
    hasEnv,
    hasStored,
    activeSource: hasEnv ? "env" : hasStored ? "stored" : "none",
  } as const;
}
