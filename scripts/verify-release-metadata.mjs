import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function fail(message) {
  console.error(`[release-metadata] ${message}`);
  process.exitCode = 1;
}

function decodeStrictBase64(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    return null;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    return null;
  }

  const decoded = Buffer.from(value, 'base64');
  return decoded.toString('base64') === value ? decoded.toString('utf8') : null;
}

const packageJson = readJson('package.json');
const tauriConfig = readJson('src-tauri/tauri.conf.json');
const cargoToml = readText('src-tauri/Cargo.toml');
const updateManifest = fs.existsSync(path.join(root, 'update.json')) ? readJson('update.json') : null;

const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const expectedVersion = packageJson.version;

if (!expectedVersion) fail('package.json is missing version');
if (cargoVersion !== expectedVersion) {
  fail(`src-tauri/Cargo.toml version ${cargoVersion ?? '<missing>'} does not match package.json ${expectedVersion}`);
}
if (tauriConfig.version !== expectedVersion) {
  fail(`src-tauri/tauri.conf.json version ${tauriConfig.version ?? '<missing>'} does not match package.json ${expectedVersion}`);
}

const updater = tauriConfig.plugins?.updater;
if (updater?.active) {
  if (!Array.isArray(updater.endpoints) || updater.endpoints.length === 0) {
    fail('updater is active but has no endpoints');
  }
  if (typeof updater.pubkey !== 'string' || updater.pubkey.trim().length === 0) {
    fail('updater is active but pubkey is missing');
  }
  if (!updateManifest) {
    fail('updater is active but update.json is missing from the repo');
  }
}

if (updateManifest) {
  if (updateManifest.version !== expectedVersion) {
    fail(`update.json version ${updateManifest.version ?? '<missing>'} does not match package.json ${expectedVersion}`);
  }
  const windows = updateManifest.platforms?.['windows-x86_64'];
  if (!windows) {
    fail('update.json is missing platforms.windows-x86_64');
  } else {
    const expectedTag = `v${expectedVersion}`;
    if (typeof windows.url !== 'string' || !windows.url.includes(expectedTag)) {
      fail(`update.json windows URL must point at release tag ${expectedTag}`);
    }
    if (typeof windows.signature !== 'string' || windows.signature.trim().length === 0) {
      fail('update.json windows signature is missing');
    } else {
      const decodedSignature = decodeStrictBase64(windows.signature);
      if (!decodedSignature) {
        fail('update.json windows signature must be base64-encoded .sig contents');
      } else if (!decodedSignature.includes('signature from tauri secret key')) {
        fail('update.json windows signature does not look like a Tauri updater signature');
      }
    }
  }
  if (Number.isNaN(Date.parse(updateManifest.pub_date))) {
    fail('update.json pub_date is missing or invalid');
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`[release-metadata] ok (${expectedVersion})`);
