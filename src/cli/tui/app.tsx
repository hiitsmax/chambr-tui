import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

import { getActiveChamber, createChamberRecord } from "../../runtime/chamber-service";
import { runHeadless } from "../../runtime/run";
import { renderEventLine } from "../../utils/events";
import {
  completeSlashComposer,
  executeSlashCommand,
  getSlashSuggestions,
  isSingleSlashCommandInput,
  type SlashCommandDefinition,
} from "./slash";
import { getCommandCenterDefinition, type CommandCenterDefinition } from "./command-center";

const MAX_LINES = 500;
const MAX_SUGGESTIONS = 6;

type CommandCenterMode = "select" | "input";

type CommandCenterState = {
  definition: CommandCenterDefinition;
  actionIndex: number;
  mode: CommandCenterMode;
  draft: string;
  error?: string;
};

const truncateLines = (lines: string[]) => {
  if (lines.length <= MAX_LINES) return lines;
  return lines.slice(lines.length - MAX_LINES);
};

const cycleIndex = (index: number, delta: number, size: number) => {
  if (size <= 0) return 0;
  if (size === 1) return 0;
  return (index + delta + size) % size;
};

export function ChambrTuiApp() {
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Loading chamber...");
  const [showThoughts, setShowThoughts] = useState(true);
  const [activeChamberId, setActiveChamberId] = useState<string>("-");
  const [slashSelectionIndex, setSlashSelectionIndex] = useState(0);
  const [commandCenter, setCommandCenter] = useState<CommandCenterState | null>(null);
  const terminalRows = process.stdout.rows || 40;

  const pushLine = useCallback((line: string) => {
    setLines((previous) => truncateLines([...previous, line]));
  }, []);

  const slashHelperVisible = input.trimStart().startsWith("/") && !running && !commandCenter;

  const slashSuggestions = useMemo(() => {
    if (!slashHelperVisible) return [];
    return getSlashSuggestions(input).slice(0, MAX_SUGGESTIONS);
  }, [input, slashHelperVisible]);

  useEffect(() => {
    if (!slashSuggestions.length) {
      setSlashSelectionIndex(0);
      return;
    }
    setSlashSelectionIndex((current) => Math.min(current, slashSuggestions.length - 1));
  }, [slashSuggestions.length]);

  const transcriptViewportRows = useMemo(() => {
    const helperRows = slashHelperVisible ? Math.min(slashSuggestions.length, MAX_SUGGESTIONS) + 3 : 0;
    const commandRows = commandCenter ? 5 : 0;
    const reserved = helperRows + commandRows + 6;
    return Math.max(8, terminalRows - reserved);
  }, [commandCenter, slashHelperVisible, slashSuggestions.length, terminalRows]);

  const visibleLines = useMemo(() => {
    return lines.slice(Math.max(0, lines.length - transcriptViewportRows));
  }, [lines, transcriptViewportRows]);

  const refreshActiveChamber = useCallback(async () => {
    const chamber = await getActiveChamber();
    if (!chamber) return;
    setActiveChamberId(chamber.id);
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

  const executeSlash = useCallback(
    async (commandLine: string) => {
      const result = await executeSlashCommand(commandLine);
      for (const line of result.lines) {
        pushLine(line);
      }
      if (typeof result.showThoughts === "boolean") {
        setShowThoughts(result.showThoughts);
      }
      if (result.runPrompt) {
        await runPrompt(result.runPrompt);
        return;
      }
      await refreshActiveChamber();
      setStatus(`Ready · chamber=${activeChamberId} · thoughts=${showThoughts ? "show" : "hide"}`);
    },
    [activeChamberId, pushLine, refreshActiveChamber, runPrompt, showThoughts]
  );

  const openCommandCenter = useCallback((commandName: string) => {
    const definition = getCommandCenterDefinition(commandName);
    if (!definition) return false;

    setCommandCenter({
      definition,
      actionIndex: 0,
      mode: "select",
      draft: "",
    });
    setStatus(`Command Center · /${definition.command} · ↑↓ select · Enter choose · Esc close`);
    return true;
  }, []);

  const executeCommandCenterAction = useCallback(
    async (valueOverride?: string) => {
      if (!commandCenter) return;
      const action = commandCenter.definition.actions[commandCenter.actionIndex];
      if (!action) return;

      const draft = typeof valueOverride === "string" ? valueOverride : commandCenter.draft;
      if (action.input?.required && !draft.trim()) {
        setCommandCenter((previous) => {
          if (!previous) return null;
          return {
            ...previous,
            error: `${action.input?.label || "Value"} is required.`,
          };
        });
        return;
      }

      const commandLine = action.buildCommand(draft);
      setCommandCenter(null);
      setInput("");
      pushLine(`[manager] /${commandLine}`);
      await executeSlash(commandLine);
    },
    [commandCenter, executeSlash, pushLine]
  );

  useInput((typed, key) => {
    if (running) return;

    if (commandCenter) {
      if (key.escape) {
        if (commandCenter.mode === "input") {
          setCommandCenter((previous) => {
            if (!previous) return null;
            return {
              ...previous,
              mode: "select",
              draft: "",
              error: undefined,
            };
          });
          setStatus(`Command Center · /${commandCenter.definition.command} · ↑↓ select · Enter choose · Esc close`);
          return;
        }

        setCommandCenter(null);
        setStatus(`Ready · chamber=${activeChamberId} · thoughts=${showThoughts ? "show" : "hide"}`);
        return;
      }

      if (commandCenter.mode === "select") {
        const actionsSize = commandCenter.definition.actions.length;

        if (key.downArrow || (key.ctrl && typed === "n")) {
          setCommandCenter((previous) => {
            if (!previous) return null;
            return {
              ...previous,
              actionIndex: cycleIndex(previous.actionIndex, 1, actionsSize),
              error: undefined,
            };
          });
          return;
        }

        if (key.upArrow || (key.ctrl && typed === "p")) {
          setCommandCenter((previous) => {
            if (!previous) return null;
            return {
              ...previous,
              actionIndex: cycleIndex(previous.actionIndex, -1, actionsSize),
              error: undefined,
            };
          });
          return;
        }

        if (key.return) {
          const action = commandCenter.definition.actions[commandCenter.actionIndex];
          if (!action) return;

          if (action.input) {
            setCommandCenter((previous) => {
              if (!previous) return null;
              return {
                ...previous,
                mode: "input",
                draft: "",
                error: undefined,
              };
            });
            setStatus(`/${commandCenter.definition.command} · ${action.input.label}`);
            return;
          }

          void executeCommandCenterAction("");
        }
      }

      return;
    }

    if (!slashHelperVisible || !slashSuggestions.length) return;

    if (key.downArrow || (key.ctrl && typed === "n")) {
      setSlashSelectionIndex((current) => cycleIndex(current, 1, slashSuggestions.length));
      return;
    }

    if (key.upArrow || (key.ctrl && typed === "p")) {
      setSlashSelectionIndex((current) => cycleIndex(current, -1, slashSuggestions.length));
      return;
    }

    if (key.tab) {
      const selected = slashSuggestions[slashSelectionIndex] || slashSuggestions[0];
      if (!selected) return;
      setInput((previous) => completeSlashComposer(previous, selected.name));
    }
  });

  const submit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      setInput("");
      if (!trimmed) return;
      if (running) return;

      if (trimmed.startsWith("/")) {
        if (isSingleSlashCommandInput(trimmed)) {
          const selected = slashSuggestions[slashSelectionIndex] || slashSuggestions[0];
          const commandName = selected?.name || trimmed.slice(1).trim();
          if (commandName && openCommandCenter(commandName)) {
            return;
          }
        }

        try {
          await executeSlash(trimmed.slice(1));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          pushLine(`Command error: ${message}`);
          setStatus(`Command error · ${message}`);
        }
        return;
      }

      await runPrompt(trimmed);
    },
    [executeSlash, openCommandCenter, pushLine, runPrompt, running, slashSelectionIndex, slashSuggestions]
  );

  const commandCenterAction = commandCenter?.definition.actions[commandCenter.actionIndex];

  const placeholder = useMemo(() => {
    if (running) return "Running...";
    return "Type a message or / to open command helper";
  }, [running]);

  const commandInputPlaceholder = commandCenterAction?.input?.placeholder || "";

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {commandCenter ? (
        <Box flexDirection="column" borderStyle="double" borderColor="magenta" paddingX={1} paddingY={0} flexGrow={1}>
          <Text color="magenta">Command Center · /{commandCenter.definition.command}</Text>
          <Text color="gray">{commandCenter.definition.subtitle}</Text>

          <Box flexDirection="column" marginTop={1}>
            {commandCenter.definition.actions.map((action, index) => {
              const selected = index === commandCenter.actionIndex;
              return (
                <Text key={action.id} color={selected ? "cyan" : undefined}>
                  {selected ? "›" : " "} {action.label} - {action.description}
                </Text>
              );
            })}
          </Box>

          <Box marginTop={1}>
            <Text color="yellow">Preview: {commandCenterAction?.commandPreview || "-"}</Text>
          </Box>
          {commandCenter.error ? (
            <Box marginTop={1}>
              <Text color="red">{commandCenter.error}</Text>
            </Box>
          ) : null}
          <Box marginTop={1}>
            <Text color="gray">Keys: ↑↓ navigate · Enter choose · Esc back</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0} flexGrow={1}>
          <Text color="cyan">Chambr TUI · chamber={activeChamberId}</Text>
          {visibleLines.length === 0 ? <Text color="gray">No messages yet. Say something to start.</Text> : null}
          {visibleLines.map((line, index) => (
            <Text key={`${index}-${line.slice(0, 12)}`}>{line}</Text>
          ))}
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        {slashHelperVisible && slashSuggestions.length ? (
          <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
            <Text color="yellow">Slash Helper · Tab autocomplete · Enter opens manager</Text>
            {slashSuggestions.map((command: SlashCommandDefinition, index) => {
              const selected = index === slashSelectionIndex;
              return (
                <Text key={command.name} color={selected ? "cyan" : undefined}>
                  {selected ? "›" : " "} /{command.name} - {command.description}
                </Text>
              );
            })}
          </Box>
        ) : null}

        <Box marginTop={1}>
          <Text color="gray">{status}</Text>
        </Box>

        <Box
          marginTop={1}
          borderStyle="round"
          borderColor={commandCenter ? "magenta" : "green"}
          paddingX={1}
          paddingY={0}
        >
          {commandCenter && commandCenter.mode === "input" ? (
            <>
              <Text color="magenta">/{commandCenter.definition.command} </Text>
              <TextInput
                value={commandCenter.draft}
                onChange={(value) => {
                  setCommandCenter((previous) => {
                    if (!previous) return null;
                    return {
                      ...previous,
                      draft: value,
                      error: undefined,
                    };
                  });
                }}
                onSubmit={(value) => {
                  void executeCommandCenterAction(value);
                }}
                placeholder={commandInputPlaceholder}
              />
            </>
          ) : commandCenter ? (
            <Text color="gray">Select an action and press Enter. Esc closes command center.</Text>
          ) : (
            <>
              <Text color="green">{running ? "…" : ">"} </Text>
              <TextInput value={input} onChange={setInput} onSubmit={submit} placeholder={placeholder} />
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
