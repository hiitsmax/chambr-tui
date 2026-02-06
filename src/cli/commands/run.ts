import type { CAC } from "cac";

import { CliError, EXIT_CODES } from "../exit-codes";
import { runHeadless } from "../../runtime/run";
import { CHAMBR_SCHEMA_VERSION } from "../../types/contracts";

const normalizeTier = (value: unknown): "BASE" | "PRO" | "MAX" | undefined => {
  if (value === "BASE" || value === "PRO" || value === "MAX") return value;
  return undefined;
};

export const registerRunCommand = (cli: CAC) => {
  cli
    .command("run", "Run one non-interactive chamber turn")
    .option("--prompt <text>", "User prompt text")
    .option("--chamber <id>", "Chamber id (defaults to active chamber)")
    .option("--preset <preset>", "Preset id override")
    .option("--model <model>", "Default roomie model override")
    .option("--director-model <model>", "Director model override")
    .option("--summarizer-model <model>", "Summarizer model override")
    .option("--fixture-mode <mode>", "live|record|replay", { default: "live" })
    .option("--fixture-name <name>", "Fixture file name")
    .option("--roomies-file <path>", "JSON roomies file override")
    .option("--user-name <name>", "User display name override")
    .option("--user-tier <tier>", "BASE|PRO|MAX")
    .option("--json", "Emit full JSON envelope to stdout")
    .option("--quiet", "Disable stderr progress logs")
    .action(async (options) => {
      const prompt = typeof options.prompt === "string" ? options.prompt.trim() : "";
      if (!prompt) {
        throw new CliError("--prompt is required for run mode.", {
          code: "RUN_PROMPT_REQUIRED",
          exitCode: EXIT_CODES.VALIDATION,
        });
      }

      const fixtureMode =
        options.fixtureMode === "record" || options.fixtureMode === "replay"
          ? options.fixtureMode
          : "live";

      try {
        const result = await runHeadless({
          prompt,
          chamberId: options.chamber,
          presetId: options.preset,
          model: options.model,
          directorModel: options.directorModel,
          summarizerModel: options.summarizerModel,
          fixtureMode,
          fixtureName: options.fixtureName,
          roomiesFile: options.roomiesFile,
          userName: options.userName,
          userTier: normalizeTier(options.userTier),
          logToStderr: !Boolean(options.quiet),
        });

        if (options.json) {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          return;
        }

        process.stdout.write(`${result.output?.transcript || ""}\n`);
        process.stdout.write(
          `\n[run] chamber=${result.chamberId} events=${result.metrics?.totalEvents || 0} latency=${result.durationMs}ms\n`
        );
      } catch (error) {
        if (options.json) {
          const cliError =
            error instanceof CliError
              ? error
              : new CliError(error instanceof Error ? error.message : String(error), {
                  code: "RUN_FAILED",
                  exitCode: EXIT_CODES.UNEXPECTED,
                });

          process.stdout.write(
            `${JSON.stringify(
              {
                schemaVersion: CHAMBR_SCHEMA_VERSION,
                status: "error",
                runId: "n/a",
                chamberId: options.chamber || "unknown",
                mode: "headless",
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString(),
                durationMs: 0,
                input: {
                  prompt,
                  presetId: options.preset || "balanced",
                  fixtureMode,
                  ...(options.fixtureName ? { fixtureName: options.fixtureName } : {}),
                  roomieIds: [],
                  modelConfig: {
                    defaultAgentModel: options.model || "unknown",
                    directorModel: options.directorModel || "unknown",
                    summarizerModel: options.summarizerModel || "unknown",
                  },
                },
                error: {
                  code: cliError.code,
                  message: cliError.message,
                },
              },
              null,
              2
            )}\n`
          );
          process.exitCode = cliError.exitCode;
          return;
        }

        throw error;
      }
    });
};
