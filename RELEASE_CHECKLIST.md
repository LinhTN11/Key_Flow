# Release Checklist

## Preflight

- [ ] `npm run lint` exits with 0 errors.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run verify:release` passes.
- [ ] `npm run build` passes.
- [ ] `cd src-tauri && cargo fmt --check` passes.
- [ ] `cd src-tauri && cargo clippy --locked -- -D warnings` passes.
- [ ] `cd src-tauri && cargo check --locked` passes.
- [ ] Manual smoke test covers practice, record pattern, library CRUD, settings, and each popout.

## Build

- [ ] Confirm `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` use the same version.
- [ ] If SQLite tables changed, add a new migration and increment `SCHEMA_VERSION` in `src/renderer/services/db.ts`.
- [ ] Run `npm run build:tauri`.
- [ ] For reproducible CI artifacts, run the GitHub Actions `Release` workflow or push a `v*` tag.
- [ ] Keep generated bundles out of git.

## Signing And Updates

- [ ] Sign the installer artifacts.
- [ ] Generate or refresh `update.json` from the signed artifacts.
- [ ] Verify `update.json` version, URLs, dates, and signatures.
- [ ] Upload artifacts and manifest to the release endpoint configured in `src-tauri/tauri.conf.json`.

## Post-release

- [ ] Install the released MSI/NSIS package on a clean Windows machine.
- [ ] Verify global input capture, OBS popout capture, SQLite persistence, and update check behavior.
