#!/usr/bin/env node
/**
 * Release desktop app.
 * Usage: pnpm release:desktop [patch|minor|major]  (default: patch)
 *
 * - Bumps version in tauri.conf.json and Cargo.toml
 * - Commits the version bump
 * - Tags desktop-vX.Y.Z
 * - Pushes branch + tag → triggers GitHub Actions build
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tauriConfPath = resolve(root, 'apps/desktop/src-tauri/tauri.conf.json');
const cargoPath = resolve(root, 'apps/desktop/src-tauri/Cargo.toml');

const bump = process.argv[2] ?? 'patch';
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: pnpm release:desktop [patch|minor|major]');
  process.exit(1);
}

// Read current version from tauri.conf.json
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
const current = tauriConf.version;
const [maj, min, pat] = current.split('.').map(Number);

let next;
if (bump === 'major') next = `${maj + 1}.0.0`;
else if (bump === 'minor') next = `${maj}.${min + 1}.0`;
else next = `${maj}.${min}.${pat + 1}`;

console.log(`Bumping ${current} → ${next} (${bump})`);

// Update tauri.conf.json
tauriConf.version = next;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');

// Update Cargo.toml (first version = line in [package])
const cargo = readFileSync(cargoPath, 'utf8');
const updatedCargo = cargo.replace(
  /^(version\s*=\s*)"[^"]+"/m,
  `$1"${next}"`
);
writeFileSync(cargoPath, updatedCargo);

const tag = `desktop-v${next}`;

// Commit + tag + push
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

run(`git add apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml`);
run(`git commit -m "chore: bump desktop version to ${next}"`);
run(`git tag ${tag}`);
run(`git push origin HEAD`);
run(`git push origin ${tag}`);

console.log(`\nDone! Build triggered at https://github.com/intakesense/taskFlow/actions`);
console.log(`Tag: ${tag}`);
