import type { CAC } from "cac";

import { authLogin, authLogout, authStatus } from "../../runtime/auth-service";
import { CliError, EXIT_CODES } from "../exit-codes";

export const registerAuthCommands = (cli: CAC) => {
  cli
    .command("auth [...args]", "Auth commands: login/logout/status")
    .option("--key <key>", "OpenRouter API key for login")
    .action(async (args: string[], options: { key?: string }) => {
      const [sub] = args;

      if (sub === "login") {
        await authLogin({ key: options.key });
        process.stdout.write("OpenRouter key saved.\n");
        return;
      }

      if (sub === "logout") {
        await authLogout({});
        process.stdout.write("Stored OpenRouter key removed.\n");
        return;
      }

      if (sub === "status") {
        const status = await authStatus({});
        process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
        return;
      }

      if (!sub) {
        process.stdout.write("Usage: chambr auth <login|logout|status>\n");
        return;
      }

      throw new CliError("Invalid auth command. Use: auth login|logout|status", {
        code: "AUTH_COMMAND_INVALID",
        exitCode: EXIT_CODES.VALIDATION,
      });
    });
};
