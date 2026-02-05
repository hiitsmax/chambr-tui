import {
  parseNdjsonTheatricalEvents,
  type TheatricalEvent,
  type TheatricalEventType,
} from "@chambr/engine-core";

export type ThoughtVisibilityMode = "show" | "hide";

export type TuiRuntimeOptions = {
  mode?: "interactive" | "headless";
  presetId?: string;
  directorModel?: string;
  thoughtVisibility?: ThoughtVisibilityMode;
};

export type TuiRuntime = {
  mode: "interactive" | "headless";
  presetId: string;
  directorModel: string;
  start: () => string;
  toggleThoughtVisibility: () => ThoughtVisibilityMode;
  setThoughtVisibility: (mode: ThoughtVisibilityMode) => void;
  getThoughtVisibility: () => ThoughtVisibilityMode;
  ingestNdjson: (raw: string, fallbackAuthor?: string) => TheatricalEvent[];
  getEvents: () => TheatricalEvent[];
  renderEvents: (events?: TheatricalEvent[]) => string;
};

const ICON_BY_TYPE: Record<TheatricalEventType, string> = {
  speak: "💬",
  action: "🎬",
  thought: "💭",
};

const formatEvent = (event: TheatricalEvent) => {
  const icon = ICON_BY_TYPE[event.type];
  return `${icon} ${event.author} (${event.type}) ${event.content}`;
};

export function createTuiRuntime(options: TuiRuntimeOptions = {}): TuiRuntime {
  let thoughtVisibility: ThoughtVisibilityMode = options.thoughtVisibility ?? "show";
  let eventCounter = 0;
  const events: TheatricalEvent[] = [];

  const nextEventId = () => {
    eventCounter += 1;
    return `tui-${eventCounter}`;
  };

  const filterForDisplay = (entries: TheatricalEvent[]) => {
    if (thoughtVisibility === "show") return entries;
    return entries.filter((event) => event.type !== "thought");
  };

  return {
    mode: options.mode ?? "interactive",
    presetId: options.presetId ?? "balanced",
    directorModel: options.directorModel ?? "default",
    start() {
      return `@chambr/tui ready (preset=${this.presetId}, thoughtVisibility=${thoughtVisibility})`;
    },
    toggleThoughtVisibility() {
      thoughtVisibility = thoughtVisibility === "show" ? "hide" : "show";
      return thoughtVisibility;
    },
    setThoughtVisibility(mode: ThoughtVisibilityMode) {
      thoughtVisibility = mode;
    },
    getThoughtVisibility() {
      return thoughtVisibility;
    },
    ingestNdjson(raw: string, fallbackAuthor = "Roomie") {
      const parsed = parseNdjsonTheatricalEvents({
        raw,
        defaultAuthor: fallbackAuthor,
        defaultBeatId: "tui-live",
        origin: "roomie",
        nextEventId,
      });

      if (!parsed.ok) {
        return [];
      }

      events.push(...parsed.events);
      return parsed.events;
    },
    getEvents() {
      return [...events];
    },
    renderEvents(inputEvents) {
      const source = inputEvents ? [...inputEvents] : [...events];
      const visible = filterForDisplay(source);
      if (!visible.length) return "(no events)";
      return visible.map((event) => formatEvent(event)).join("\n");
    },
  };
}
