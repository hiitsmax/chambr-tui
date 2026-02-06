import type { CAC } from "cac";
import React from "react";
import { render } from "ink";

import { ChambrTuiApp } from "../tui/app";

const ENTER_ALTERNATE_SCREEN = "\u001B[?1049h";
const EXIT_ALTERNATE_SCREEN = "\u001B[?1049l";
const CURSOR_HIDE = "\u001B[?25l";
const CURSOR_SHOW = "\u001B[?25h";
const CLEAR_SCREEN = "\u001B[2J\u001B[H";

export const registerTuiCommand = (cli: CAC) => {
  cli.command("tui", "Start interactive Chambr terminal UI").action(() => {
    const useAlternateScreen = Boolean(process.stdout.isTTY && process.stdin.isTTY);
    let restored = false;

    const restoreTerminal = () => {
      if (!useAlternateScreen || restored) return;
      restored = true;
      process.stdout.write(`${CURSOR_SHOW}${EXIT_ALTERNATE_SCREEN}`);
    };

    if (useAlternateScreen) {
      process.stdout.write(`${ENTER_ALTERNATE_SCREEN}${CLEAR_SCREEN}${CURSOR_HIDE}`);
    }

    const instance = render(React.createElement(ChambrTuiApp), {
      exitOnCtrlC: true,
    });

    void instance.waitUntilExit().finally(() => {
      restoreTerminal();
    });

    process.once("exit", restoreTerminal);
  });
};
