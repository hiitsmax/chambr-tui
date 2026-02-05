export type TuiRuntimeOptions = {
  mode?: "interactive" | "headless";
};

export function createTuiRuntime(options: TuiRuntimeOptions = {}) {
  return {
    mode: options.mode ?? "interactive",
    start() {
      return "@chambr/tui bootstrap ready";
    },
  };
}
