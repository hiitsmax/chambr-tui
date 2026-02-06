import type { CAC } from "cac";

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
import { CliError, EXIT_CODES } from "../exit-codes";

type ChamberOptions = {
  goal?: string;
  preset?: string;
  id?: string;
  chamber?: string;
  director?: string;
  name?: string;
  bio?: string;
  model?: string;
  traits?: string;
  roomie?: string;
};

const printUsage = () => {
  process.stdout.write(
    [
      "chamber commands:",
      "  chamber create [name] [--goal ...] [--preset ...] [--id ...]",
      "  chamber list",
      "  chamber use <id>",
      "  chamber reset [id]",
      "  chamber model --director <model> [--chamber <id>]",
      "  chamber roomies add --name ... --bio ... [--model ...]",
      "  chamber roomies list [--chamber <id>]",
      "  chamber roomies set-model --roomie <id> --model <model>",
      "  chamber roomies list-models [--chamber <id>]",
    ].join("\n") + "\n"
  );
};

export const registerChamberCommands = (cli: CAC) => {
  cli
    .command("chamber [...args]", "Chamber management commands")
    .option("--goal <goal>", "Chamber goal")
    .option("--preset <preset>", "Preset id")
    .option("--id <id>", "Chamber id or roomie id depending on subcommand")
    .option("--chamber <id>", "Chamber id")
    .option("--director <model>", "Director model")
    .option("--name <name>", "Roomie name")
    .option("--bio <bio>", "Roomie bio")
    .option("--model <model>", "Model id")
    .option("--traits <traits>", "Roomie traits")
    .option("--roomie <id>", "Roomie id")
    .action(async (args: string[], options: ChamberOptions) => {
      const [sub, sub2, maybeArg] = args;

      if (sub === "create") {
        const chamber = await createChamberRecord({
          name: maybeArg,
          goal: options.goal,
          presetId: options.preset,
          id: options.id,
        });
        process.stdout.write(`Created chamber '${chamber.id}' and set as active.\n`);
        return;
      }

      if (sub === "list") {
        const chambers = await listChamberRecords();
        if (!chambers.length) {
          process.stdout.write("No chambers found.\n");
          return;
        }
        for (const chamber of chambers) {
          process.stdout.write(
            `${chamber.id}\t${chamber.name}\troomies=${chamber.roomies.length}\tupdated=${chamber.updatedAt}\n`
          );
        }
        return;
      }

      if (sub === "use") {
        if (!sub2) {
          throw new CliError("Usage: chamber use <id>", {
            code: "CHAMBER_USE_INVALID",
            exitCode: EXIT_CODES.VALIDATION,
          });
        }
        const chamber = await useChamberRecord(sub2);
        process.stdout.write(`Active chamber: ${chamber.id}\n`);
        return;
      }

      if (sub === "reset") {
        const chamber = await resetChamberRecord(sub2);
        process.stdout.write(`Reset chamber '${chamber.id}' runtime state.\n`);
        return;
      }

      if (sub === "model") {
        const chamber = await setDirectorModelInChamber({
          chamberId: options.chamber,
          directorModel: options.director || "",
        });
        process.stdout.write(`Director model set to '${chamber.advanced.directorModel}'.\n`);
        return;
      }

      if (sub === "roomies") {
        if (sub2 === "add") {
          const chamber = await addRoomieToChamber({
            chamberId: options.chamber,
            name: options.name || "",
            bio: options.bio || "",
            id: options.id,
            model: options.model,
            traits: options.traits,
          });
          process.stdout.write(`Roomie added. Chamber '${chamber.id}' now has ${chamber.roomies.length} roomies.\n`);
          return;
        }

        if (sub2 === "list") {
          const roomies = await listRoomiesInChamber({ chamberId: options.chamber });
          if (!roomies.length) {
            process.stdout.write("No roomies in chamber.\n");
            return;
          }
          for (const roomie of roomies) {
            process.stdout.write(`${roomie.id}\t${roomie.name}\t${roomie.model || "(inherited)"}\n`);
          }
          return;
        }

        if (sub2 === "set-model") {
          await setRoomieModelInChamber({
            chamberId: options.chamber,
            roomieId: options.roomie || maybeArg || "",
            model: options.model || "",
          });
          process.stdout.write("Roomie model updated.\n");
          return;
        }

        if (sub2 === "list-models") {
          const models = await listRoomieModelsInChamber({ chamberId: options.chamber });
          if (!models.length) {
            process.stdout.write("No roomies in chamber.\n");
            return;
          }
          for (const item of models) {
            process.stdout.write(
              `${item.roomieId}\t${item.roomieName}\t${item.model}${item.inherited ? "\t(inherited)" : ""}\n`
            );
          }
          return;
        }

        throw new CliError("Invalid roomies subcommand. Use add|list|set-model|list-models", {
          code: "ROOMIES_COMMAND_INVALID",
          exitCode: EXIT_CODES.VALIDATION,
        });
      }

      if (!sub) {
        printUsage();
        return;
      }

      throw new CliError(`Invalid chamber command '${sub}'.`, {
        code: "CHAMBER_COMMAND_INVALID",
        exitCode: EXIT_CODES.VALIDATION,
      });
    });
};
