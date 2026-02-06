import {
  parseNdjsonTheatricalEvents,
  type TheatricalEvent,
  type TheatricalEventType,
} from "@chambr/engine-core";

const ICON_BY_TYPE: Record<TheatricalEventType, string> = {
  speak: "💬",
  action: "🎬",
  thought: "💭",
};

export const renderEventLine = (event: TheatricalEvent) => {
  const icon = ICON_BY_TYPE[event.type] || "•";
  return `${icon} ${event.author} (${event.type}) ${event.content}`;
};

export const renderTranscript = (events: TheatricalEvent[], params?: { showThoughts?: boolean }) => {
  const showThoughts = params?.showThoughts ?? true;
  const lines = events
    .filter((event) => showThoughts || event.type !== "thought")
    .map((event) => renderEventLine(event));
  if (!lines.length) return "(no events)";
  return lines.join("\n");
};

export const parseEventNdjson = (raw: string, fallbackAuthor = "Roomie") => {
  return parseNdjsonTheatricalEvents({
    raw,
    defaultAuthor: fallbackAuthor,
    defaultBeatId: "local",
    origin: "roomie",
    nextEventId: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `evt-${counter}`;
      };
    })(),
  });
};
