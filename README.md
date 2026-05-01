# KeyFlow

KeyFlow is a Tauri desktop app for recording keyboard and mouse combo patterns, practicing against them, and reviewing timing feedback with keyboard, chart, and score popout windows for OBS capture.

## Requirements

- Node.js 20 or newer
- Rust toolchain compatible with `rust-version = 1.77.2`
- Windows build tools for creating MSI/NSIS installers

## Development

```bash
npm install
npm run dev:tauri
```

For frontend-only work:

```bash
npm run dev
```

## Quality Gates

Run these before cutting a release:

```bash
npm run lint
npm run typecheck
npm test
npm run build
cd src-tauri
cargo check
```

## Release Build

```bash
npm run build:tauri
```

The Windows bundles are written under:

```text
src-tauri/target/release/bundle/
```

## Data And Privacy

KeyFlow uses a global keyboard/mouse listener so it can record combo input while a game has focus. Native capture is reference-counted and only emits input while a practice or popout view is subscribed. Pattern, session, attempt, and settings data are stored locally in SQLite through the Tauri SQL plugin.

## Auto Update

The updater is configured in `src-tauri/tauri.conf.json`. Release manifests must be generated from signed artifacts; do not hand-edit signatures in `update.json`.
