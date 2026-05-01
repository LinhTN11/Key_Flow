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

- [ ] For updates from `v0.1.1`, keep `src-tauri/tauri.conf.json` `identifier` as `com.keyflow.app`, `productName` as `keyflow`, and the updater `pubkey` as the original `C45A9FC244FE9DF8` public key.
- [ ] Sign the installer artifacts with the original updater private key used by `v0.1.1`. A newly generated key cannot update existing `v0.1.1` installs.
- [ ] Generate or refresh `update.json` from the signed artifacts. The `signature` value must be base64-encoded `.sig` contents, not the raw text printed in a terminal.
- [ ] Verify `update.json` version, URLs, dates, and signatures.
- [ ] Upload artifacts and manifest to the release endpoint configured in `src-tauri/tauri.conf.json`.

## Rebuilding The v1.0.0 Bridge Update

Use this flow when replacing a broken release so users on `v0.1.1` can update in-app:

1. Delete the broken GitHub release and tag, for example `v1.0.1`, from GitHub.
2. Build the bridge release with version `1.0.0`, identifier `com.keyflow.app`, and product name `keyflow`.
3. Build/sign with the original `v0.1.1` updater private key:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "C:\path\to\original-tauri-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<old-key-password>"
npm run build:tauri
```

4. Sign the MSI if the build did not emit a `.sig` file:

```powershell
npx tauri signer sign `
  --private-key-path "C:\path\to\original-tauri-updater.key" `
  --password "<old-key-password>" `
  "src-tauri\target\release\bundle\msi\keyflow_1.0.0_x64_en-US.msi"
```

5. Generate `update.json` from the `.sig` file:

```powershell
npm run write:update-manifest -- `
  --url "https://github.com/LinhTN11/Key_Flow/releases/download/v1.0.0/keyflow_1.0.0_x64_en-US.msi" `
  --signature "src-tauri\target\release\bundle\msi\keyflow_1.0.0_x64_en-US.msi.sig"
```

6. Create/upload the GitHub release `v1.0.0` with `keyflow_1.0.0_x64_en-US.msi`.
7. Run `npm run verify:release`, commit `update.json`, and push to `main`.

## Post-release

- [ ] Install the released MSI/NSIS package on a clean Windows machine.
- [ ] Verify global input capture, OBS popout capture, SQLite persistence, and update check behavior.
