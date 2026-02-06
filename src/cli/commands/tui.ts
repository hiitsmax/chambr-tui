import type { CAC } from "cac";
import React from "react";
import { render } from "ink";

import { ChambrTuiApp } from "../tui/app";

export const registerTuiCommand = (cli: CAC) => {
  cli.command("tui", "Start interactive Chambr terminal UI").action(() => {
    render(React.createElement(ChambrTuiApp));
  });
};
