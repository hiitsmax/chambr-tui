# @chambr/tui

Terminal UI package for Chambr.

This repository is the public source of truth for TUI work.

## Install

```bash
yarn add @chambr/tui@git+https://github.com/hiitsmax/chambr-tui.git#v0.1.0
```

## Development

```bash
yarn install
yarn lint
yarn build
```

## Release (manual)

1. Bump `version` in `package.json`.
2. Commit and push to `main`.
3. Create and push a git tag `vX.Y.Z`.
4. Consumers update dependency ref to the new tag.
