import { cac } from "cac";

import { registerAuthCommands } from "./commands/auth";
import { registerChamberCommands } from "./commands/chamber";
import { registerRunCommand } from "./commands/run";
import { registerTuiCommand } from "./commands/tui";
import { CliError, EXIT_CODES } from "./exit-codes";

const cli = cac("chambr");

registerTuiCommand(cli);
registerRunCommand(cli);
registerAuthCommands(cli);
registerChamberCommands(cli);

cli.help();
cli.version("0.1.0");

cli.on("command:*", () => {
  const input = cli.args.join(" ");
  throw new CliError(`Unknown command: ${input}`, {
    code: "UNKNOWN_COMMAND",
    exitCode: EXIT_CODES.VALIDATION,
  });
});

const handleFatal = (error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
    process.exitCode = error.exitCode;
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`UNEXPECTED: ${message}\n`);
  process.exitCode = EXIT_CODES.UNEXPECTED;
};

process.on("uncaughtException", (error) => {
  handleFatal(error);
});

process.on("unhandledRejection", (error) => {
  handleFatal(error);
});

const argv = process.argv.slice(2);
if (argv.length === 0) {
  argv.push("tui");
}

try {
  cli.parse([process.argv[0] || "node", process.argv[1] || "chambr", ...argv]);
} catch (error) {
  handleFatal(error);
}
