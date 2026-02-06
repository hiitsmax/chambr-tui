# @chambr/tui

Chambr terminal client with two modes:

1. Interactive full-screen TUI: `chambr tui`
2. Non-interactive automation mode: `chambr run --prompt "..." --json`

It runs directly on `@chambr/engine-core` and stores local state in `~/.chambr`.

## Install

From source:

```bash
yarn install
yarn build
```

After install/build, binaries are available as:

- `chambr`
- `chambr-tui`

## Commands

### Interactive

```bash
chambr tui
```

- Full-screen single-pane chat UI.
- Slash helper UX:
  - Type `/` to open autocomplete.
  - Use `↑/↓` or `Ctrl+N/Ctrl+P` to navigate suggestions.
  - Press `Tab` to autocomplete command.
  - Press `Enter` on a single slash command (for example `/roomies`) to open its dedicated command center.
  - Press `Esc` to exit command center.
- Slash commands:
  - `/help`
  - `/chamber create|list|use|reset`
  - `/roomies add|list|set-model|list-models`
  - `/model --director <model>`
  - `/auth login|logout|status`
  - `/run <prompt>`
  - `/thoughts show|hide`

### Non-interactive

```bash
chambr run --prompt "Plan my launch strategy" --json
```

Recommended flags:

- `--chamber <id>`
- `--preset <id>`
- `--model <id>`
- `--director-model <id>`
- `--summarizer-model <id>`
- `--fixture-mode live|record|replay`
- `--fixture-name <name>`
- `--roomies-file <path>`
- `--user-name <name>`
- `--user-tier BASE|PRO|MAX`

In `--json` mode:

- Structured JSON envelope is written to `stdout`.
- Progress logs are written to `stderr`.

## Auth / API Key

Key precedence:

1. `OPENROUTER_API_KEY` environment variable
2. Stored key from `chambr auth login`

Commands:

```bash
chambr auth login
chambr auth login --key <OPENROUTER_API_KEY>
chambr auth status
chambr auth logout
```

Stored key location:

- `~/.chambr/config.json`

## Local Storage Layout

- `~/.chambr/config.json`
- `~/.chambr/chambers/<id>.json`
- `~/.chambr/fixtures/<name>.json`

## Fixture Workflow

Record:

```bash
chambr run --prompt "Test prompt" --fixture-mode record --fixture-name smoke --json
```

Replay:

```bash
chambr run --prompt "Test prompt" --fixture-mode replay --fixture-name smoke --json
```

Replay miss behavior:

- Fails fast (non-zero exit), no live fallback.

## JSON Envelope (run --json)

`schemaVersion: 1` envelope includes:

- `status`
- `runId`, `chamberId`, `mode`, `startedAt`, `finishedAt`, `durationMs`
- `input` (prompt, preset, fixture mode, model config, roomies)
- `output` (`events`, `transcript`, `directorPlan`, `stateRef`)
- `metrics`
- `error` (when failed)

## Exit Codes

- `0` success
- `1` unexpected/internal
- `2` auth/config
- `3` fixture replay miss
- `4` provider/network/model
- `5` validation/state/input

## Programmatic API (library)

Exports include:

- `runHeadless(params)`
- `loadChamber(id)`
- `saveChamber(state)`
- `recordFixture(...)`
- `replayFixture(...)`
- event helpers (`parseEventNdjson`, `renderEventLine`, `renderTranscript`)

## Migration Note (breaking)

The previous minimal runtime-only API (`createTuiRuntime`) has been replaced by CLI-first and headless programmatic APIs aligned with this package vision.

## Development

```bash
yarn install
yarn lint
yarn test
yarn build
```

## Release (manual)

1. Bump `version` in `package.json`.
2. Commit and push to `main`.
3. Create and push a git tag `vX.Y.Z`.
4. Consumers update dependency ref/tag.
