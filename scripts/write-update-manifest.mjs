import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
  console.error(`[write-update-manifest] ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value) {
      fail('usage: npm run write:update-manifest -- --url <installer-url> --signature <sig-file> [--notes <notes>]');
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function decodeBase64(value) {
  try {
    return Buffer.from(value, 'base64');
  } catch {
    return null;
  }
}

function validateSignatureText(signatureText) {
  const lines = signatureText.trimEnd().split(/\r?\n/);
  if (lines.length !== 4) fail('signature file must contain exactly 4 minisign lines');
  if (!lines[0].startsWith('untrusted comment: ')) fail('signature file is missing untrusted comment');
  if (!lines[2].startsWith('trusted comment: ')) fail('signature file is missing trusted comment');
  if (decodeBase64(lines[1])?.length !== 74) fail('signature file has an invalid signature payload');
  if (decodeBase64(lines[3])?.length !== 64) fail('signature file has an invalid trusted-comment signature');
}

function normalizeSignature(signatureFileText) {
  const trimmed = signatureFileText.trim();
  const decoded = decodeBase64(trimmed)?.toString('utf8');
  if (decoded) {
    validateSignatureText(decoded);
    return trimmed;
  }

  validateSignatureText(signatureFileText);
  return Buffer.from(signatureFileText, 'utf8').toString('base64');
}

const args = parseArgs(process.argv.slice(2));
const packageJson = readJson('package.json');
const signaturePath = path.resolve(root, args.signature);
const signatureText = fs.readFileSync(signaturePath, 'utf8');
const signature = normalizeSignature(signatureText);

const manifest = {
  version: packageJson.version,
  notes: args.notes ?? `Release v${packageJson.version}: Bug fixes and performance improvements.`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url: args.url,
    },
  },
};

fs.writeFileSync(path.join(root, 'update.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[write-update-manifest] wrote update.json (${packageJson.version})`);
