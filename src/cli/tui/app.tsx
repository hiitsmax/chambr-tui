import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

import { getActiveChamber, createChamberRecord } from "../../runtime/chamber-service";
import { runHeadless } from "../../runtime/run";
import { renderEventLine } from "../../utils/events";
import { executeSlashCommand } from "./slash";

const MAX_LINES = 300;

const truncateLines = (lines: string[]) => {
  if (lines.length <= MAX_LINES) return lines;
  return lines.slice(lines.length - MAX_LINES);
};

export function ChambrTuiApp() {
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Loading chamber...");
  const [showThoughts, setShowThoughts] = useState(true);
  const [activeChamberId, setActiveChamberId] = useState<string>("-");

  const pushLine = useCallback((line: string) => {
    setLines((previous) => truncateLines([...previous, line]));
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        let chamber = await getActiveChamber();
        if (!chamber) {
          chamber = await createChamberRecord({ name: "Default Chamber", presetId: "balanced" });
          pushLine(`Created default chamber '${chamber.id}'.`);
        }
        setActiveChamberId(chamber.id);
        setStatus(`Ready · chamber=${chamber.id} · thoughts=${showThoughts ? "show" : "hide"}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushLine(`Failed to initialize chamber: ${message}`);
        setStatus("Initialization failed");
      }
    })();
  }, [pushLine, showThoughts]);

  const runPrompt = useCallback(
    async (prompt: string) => {
      const normalized = prompt.trim();
      if (!normalized) return;

      setRunning(true);
      pushLine(`You: ${normalized}`);
      setStatus(`Running turn on chamber=${activeChamberId}...`);

      try {
        const result = await runHeadless({
          prompt: normalized,
          logToStderr: false,
          onBeatStart: async (payload) => {
            setStatus(`Beat ${payload.step_index + 1}: ${payload.name} (${payload.intent})`);
          },
          onEvent: async (event) => {
            if (!showThoughts && event.type === "thought") return;
            pushLine(renderEventLine(event));
          },
        });

        setActiveChamberId(result.chamberId);
        setStatus(
          `Done · chamber=${result.chamberId} · events=${result.metrics?.totalEvents || 0} · latency=${result.durationMs}ms · thoughts=${showThoughts ? "show" : "hide"}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushLine(`Error: ${message}`);
        setStatus(`Error · ${message}`);
      } finally {
        setRunning(false);
      }
    },
    [activeChamberId, pushLine, showThoughts]
  );

  const submit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      setInput("");
      if (!trimmed) return;
      if (running) return;

      if (trimmed.startsWith("/")) {
        try {
          const command = trimmed.slice(1);
          const result = await executeSlashCommand(command);
          for (const line of result.lines) {
            pushLine(line);
          }
          if (typeof result.showThoughts === "boolean") {
            setShowThoughts(result.showThoughts);
            setStatus(
              `Ready · chamber=${activeChamberId} · thoughts=${result.showThoughts ? "show" : "hide"}`
            );
          }
          if (result.runPrompt) {
            await runPrompt(result.runPrompt);
          } else {
            const chamber = await getActiveChamber();
            if (chamber) {
              setActiveChamberId(chamber.id);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          pushLine(`Command error: ${message}`);
          setStatus(`Command error · ${message}`);
        }
        return;
      }

      await runPrompt(trimmed);
    },
    [activeChamberId, pushLine, runPrompt, running]
  );

  const placeholder = useMemo(
    () =>
      running
        ? "Running..."
        : "Type a message or /help (e.g. /roomies add --name \"Ava\" --bio \"Strategist\")",
    [running]
  );

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0} flexGrow={1}>
        <Text color="cyan">Chambr TUI · chamber={activeChamberId}</Text>
        {lines.length === 0 ? <Text color="gray">No messages yet. Say something to start.</Text> : null}
        {lines.map((line, index) => (
          <Text key={`${index}-${line.slice(0, 8)}`}>{line}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color="gray">{status}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="green">{running ? "…" : ">"} </Text>
        <TextInput value={input} onChange={setInput} onSubmit={submit} placeholder={placeholder} />
      </Box>
    </Box>
  );
}
