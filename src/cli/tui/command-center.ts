import type { SlashCommandName } from "./slash";

type CommandCenterInput = {
  label: string;
  placeholder: string;
  required?: boolean;
};

export type CommandCenterAction = {
  id: string;
  label: string;
  description: string;
  commandPreview: string;
  input?: CommandCenterInput;
  buildCommand: (value?: string) => string;
};

export type CommandCenterDefinition = {
  command: SlashCommandName;
  title: string;
  subtitle: string;
  actions: CommandCenterAction[];
};

const quoteIfNeeded = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/\s/.test(trimmed)) {
    return `"${trimmed.replace(/"/g, '\\"')}"`;
  }
  return trimmed;
};

const COMMAND_CENTERS: Record<SlashCommandName, CommandCenterDefinition> = {
  chamber: {
    command: "chamber",
    title: "Chamber Manager",
    subtitle: "Create, list, switch, and reset chambers.",
    actions: [
      {
        id: "list",
        label: "List chambers",
        description: "Show known chambers with ids and roomie counts.",
        commandPreview: "/chamber list",
        buildCommand: () => "chamber list",
      },
      {
        id: "create",
        label: "Create chamber",
        description: "Create and select a new chamber.",
        commandPreview: "/chamber create <name>",
        input: {
          label: "Chamber name",
          placeholder: "e.g. release-room",
          required: true,
        },
        buildCommand: (value) => `chamber create ${quoteIfNeeded(value || "")}`,
      },
      {
        id: "use",
        label: "Use chamber",
        description: "Switch active chamber by id.",
        commandPreview: "/chamber use <id>",
        input: {
          label: "Chamber id",
          placeholder: "paste chamber id",
          required: true,
        },
        buildCommand: (value) => `chamber use ${(value || "").trim()}`,
      },
      {
        id: "reset",
        label: "Reset chamber state",
        description: "Reset runtime state for active chamber.",
        commandPreview: "/chamber reset",
        buildCommand: () => "chamber reset",
      },
    ],
  },
  roomies: {
    command: "roomies",
    title: "Roomie Manager",
    subtitle: "Add roomies and tune per-roomie models.",
    actions: [
      {
        id: "list",
        label: "List roomies",
        description: "Show roomies in active chamber.",
        commandPreview: "/roomies list",
        buildCommand: () => "roomies list",
      },
      {
        id: "list-models",
        label: "List effective models",
        description: "Show inherited vs explicit model assignments.",
        commandPreview: "/roomies list-models",
        buildCommand: () => "roomies list-models",
      },
      {
        id: "add",
        label: "Add roomie",
        description: "Pass add flags in one line.",
        commandPreview: '/roomies add --name "Ava" --bio "Strategist" [--model ...]',
        input: {
          label: "Roomie args",
          placeholder: '--name "Ava" --bio "Strategist" --model openrouter/openai/gpt-4o-mini',
          required: true,
        },
        buildCommand: (value) => `roomies add ${(value || "").trim()}`,
      },
      {
        id: "set-model",
        label: "Set roomie model",
        description: "Pass set-model flags in one line.",
        commandPreview: "/roomies set-model --roomie <id> --model <model>",
        input: {
          label: "Set-model args",
          placeholder: "--roomie ava --model openrouter/openai/gpt-4.1-mini",
          required: true,
        },
        buildCommand: (value) => `roomies set-model ${(value || "").trim()}`,
      },
    ],
  },
  model: {
    command: "model",
    title: "Director Model",
    subtitle: "Set advanced director model override.",
    actions: [
      {
        id: "set-director",
        label: "Set director model",
        description: "Choose the director model id.",
        commandPreview: "/model --director <model>",
        input: {
          label: "Director model",
          placeholder: "openrouter/openai/gpt-4.1-mini",
          required: true,
        },
        buildCommand: (value) => `model --director ${(value || "").trim()}`,
      },
    ],
  },
  auth: {
    command: "auth",
    title: "Auth",
    subtitle: "Manage OpenRouter key source and status.",
    actions: [
      {
        id: "status",
        label: "Auth status",
        description: "Inspect env vs stored key resolution.",
        commandPreview: "/auth status",
        buildCommand: () => "auth status",
      },
      {
        id: "login",
        label: "Save API key",
        description: "Store key in ~/.chambr/config.json.",
        commandPreview: "/auth login --key <key>",
        input: {
          label: "OpenRouter key",
          placeholder: "sk-or-...",
          required: true,
        },
        buildCommand: (value) => `auth login --key ${(value || "").trim()}`,
      },
      {
        id: "logout",
        label: "Clear stored key",
        description: "Remove local stored key.",
        commandPreview: "/auth logout",
        buildCommand: () => "auth logout",
      },
    ],
  },
  thoughts: {
    command: "thoughts",
    title: "Thought Visibility",
    subtitle: "Toggle rendering of thought events in transcript.",
    actions: [
      {
        id: "show",
        label: "Show thoughts",
        description: "Render thought events inline.",
        commandPreview: "/thoughts show",
        buildCommand: () => "thoughts show",
      },
      {
        id: "hide",
        label: "Hide thoughts",
        description: "Keep thought events hidden from transcript.",
        commandPreview: "/thoughts hide",
        buildCommand: () => "thoughts hide",
      },
    ],
  },
  run: {
    command: "run",
    title: "Quick Run",
    subtitle: "Run one prompt immediately from command mode.",
    actions: [
      {
        id: "run-prompt",
        label: "Run prompt",
        description: "Execute a one-off prompt in the active chamber.",
        commandPreview: "/run <prompt>",
        input: {
          label: "Prompt",
          placeholder: "e.g. propose a launch plan",
          required: true,
        },
        buildCommand: (value) => `run ${quoteIfNeeded(value || "")}`,
      },
    ],
  },
  help: {
    command: "help",
    title: "Help",
    subtitle: "Show command help and examples.",
    actions: [
      {
        id: "show-help",
        label: "Show help",
        description: "Print complete slash command reference.",
        commandPreview: "/help",
        buildCommand: () => "help",
      },
    ],
  },
};

export const getCommandCenterDefinition = (command: string): CommandCenterDefinition | null => {
  if (!command) return null;
  const key = command.trim().toLowerCase() as SlashCommandName;
  return COMMAND_CENTERS[key] || null;
};
