import { authLogin, authLogout, authStatus } from "../../runtime/auth-service";
import {
  addRoomieToChamber,
  createChamberRecord,
  listChamberRecords,
  listRoomieModelsInChamber,
  listRoomiesInChamber,
  resetChamberRecord,
  setDirectorModelInChamber,
  setRoomieModelInChamber,
  useChamberRecord,
} from "../../runtime/chamber-service";

type SlashResult = {
  lines: string[];
  runPrompt?: string;
  showThoughts?: boolean;
};

const tokenize = (input: string) => {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
};

const getFlag = (tokens: string[], flag: string) => {
  const index = tokens.indexOf(flag);
  if (index === -1) return undefined;
  return tokens[index + 1];
};

export async function executeSlashCommand(line: string): Promise<SlashResult> {
  const tokens = tokenize(line.trim());
  const [command, ...rest] = tokens;

  if (!command) {
    return { lines: ["Empty command."] };
  }

  if (command === "help") {
    return {
      lines: [
        "Slash commands:",
        "/help",
        "/chamber create [name] [--goal \"...\"] [--preset balanced]",
        "/chamber list",
        "/chamber use <id>",
        "/chamber reset [id]",
        "/roomies add --name \"...\" --bio \"...\" [--model ...]",
        "/roomies list",
        "/roomies set-model --roomie <id> --model <model>",
        "/roomies list-models",
        "/model --director <model>",
        "/auth login [--key ...]",
        "/auth logout",
        "/auth status",
        "/run <prompt>",
        "/thoughts show|hide",
      ],
    };
  }

  if (command === "run") {
    const prompt = rest.join(" ").trim();
    if (!prompt) {
      return { lines: ["Usage: /run <prompt>"] };
    }
    return { lines: [`Running: ${prompt}`], runPrompt: prompt };
  }

  if (command === "thoughts") {
    const mode = rest[0];
    if (mode === "show") return { lines: ["Thought events enabled."], showThoughts: true };
    if (mode === "hide") return { lines: ["Thought events hidden."], showThoughts: false };
    return { lines: ["Usage: /thoughts show|hide"] };
  }

  if (command === "auth") {
    const sub = rest[0];
    if (sub === "login") {
      const key = getFlag(rest, "--key");
      await authLogin({ key });
      return { lines: ["OpenRouter key saved."] };
    }
    if (sub === "logout") {
      await authLogout({});
      return { lines: ["Stored key removed."] };
    }
    if (sub === "status") {
      const status = await authStatus({});
      return { lines: [JSON.stringify(status)] };
    }
    return { lines: ["Usage: /auth login|logout|status"] };
  }

  if (command === "chamber") {
    const sub = rest[0];
    if (sub === "create") {
      const name = rest[1] && !rest[1].startsWith("--") ? rest[1] : undefined;
      const goal = getFlag(rest, "--goal");
      const preset = getFlag(rest, "--preset");
      const chamber = await createChamberRecord({ name, goal, presetId: preset });
      return { lines: [`Created and selected chamber '${chamber.id}'.`] };
    }
    if (sub === "list") {
      const chambers = await listChamberRecords();
      if (!chambers.length) return { lines: ["No chambers found."] };
      return {
        lines: chambers.map(
          (chamber) => `${chamber.id} | ${chamber.name} | roomies=${chamber.roomies.length}`
        ),
      };
    }
    if (sub === "use") {
      const id = rest[1];
      if (!id) return { lines: ["Usage: /chamber use <id>"] };
      const chamber = await useChamberRecord(id);
      return { lines: [`Active chamber: ${chamber.id}`] };
    }
    if (sub === "reset") {
      const chamber = await resetChamberRecord(rest[1]);
      return { lines: [`Reset runtime state for chamber '${chamber.id}'.`] };
    }
    return { lines: ["Usage: /chamber create|list|use|reset"] };
  }

  if (command === "roomies") {
    const sub = rest[0];
    if (sub === "add") {
      const name = getFlag(rest, "--name");
      const bio = getFlag(rest, "--bio");
      const model = getFlag(rest, "--model");
      if (!name || !bio) {
        return { lines: ["Usage: /roomies add --name <name> --bio <bio> [--model <model>]"] };
      }
      const chamber = await addRoomieToChamber({ name, bio, model });
      return { lines: [`Added roomie. Chamber '${chamber.id}' roomies=${chamber.roomies.length}`] };
    }
    if (sub === "list") {
      const roomies = await listRoomiesInChamber({});
      if (!roomies.length) return { lines: ["No roomies in active chamber."] };
      return { lines: roomies.map((roomie) => `${roomie.id} | ${roomie.name}`) };
    }
    if (sub === "set-model") {
      const roomieId = getFlag(rest, "--roomie");
      const model = getFlag(rest, "--model");
      if (!roomieId || !model) {
        return { lines: ["Usage: /roomies set-model --roomie <id> --model <model>"] };
      }
      await setRoomieModelInChamber({ roomieId, model });
      return { lines: ["Roomie model updated."] };
    }
    if (sub === "list-models") {
      const models = await listRoomieModelsInChamber({});
      if (!models.length) return { lines: ["No roomies in active chamber."] };
      return {
        lines: models.map(
          (entry) => `${entry.roomieId} | ${entry.roomieName} | ${entry.model}${entry.inherited ? " (inherited)" : ""}`
        ),
      };
    }
    return { lines: ["Usage: /roomies add|list|set-model|list-models"] };
  }

  if (command === "model") {
    const director = getFlag(rest, "--director");
    if (!director) {
      return { lines: ["Usage: /model --director <model>"] };
    }
    const chamber = await setDirectorModelInChamber({ directorModel: director });
    return { lines: [`Director model set to ${chamber.advanced.directorModel}.`] };
  }

  return { lines: [`Unknown command: /${command}. Try /help`] };
}
