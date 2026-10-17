import os from 'node:os';
import path from 'node:path';
import { doctor } from './doctor.js';
import { planCleanup } from './cleanup.js';
import { setup } from './setup.js';
import { initBank, projectInit } from './init.js';
import { paths } from '../lib/paths.js';
import { openDb } from '../kb/db.js';
import { exportAll, rebuild } from '../kb/export.js';
import { acceptMerge, rejectMerge, splitAlias } from '../kb/concepts.js';
import { pendingQuestions } from '../kb/brief.js';
import { compareConcept, compareLine, resolveConceptRef } from '../kb/compare.js';
import { setTransfer, retractNote, setAttr, kbWrite, type WriteRecord } from '../kb/write.js';
import { readFileSync } from 'node:fs';
import { sync } from '../kb/sync.js';
import { importSerena, importClaudeMemory } from '../kb/import.js';
import { generateMap } from '../kb/map.js';
import { spawn } from 'node:child_process';
const [cmd, ...args] = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const value = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const home = os.homedir();
const usage = 'usage: kb init [--bank <dir>] [--clone <url>] | kb project init --domain <d> [--id <id>] | kb doctor [--baseline] [--live] | kb cleanup [--apply] | kb setup [--device <name>] [--append-claude-md] | kb export | kb rebuild | kb concepts review|accept <id>|reject <id>|split <name> | kb transfer <id> confirm|refute | kb retract <id> | kb set <id> <attr> <value> | kb compare <concept> | kb import serena|claude-memory|all [--root <dir>] | kb sync [--quiet] | kb map [--open] | kb write <spec.json|->\n';
if (cmd === 'doctor') process.exitCode = doctor(home, { baseline: has('--baseline'), live: has('--live') });
else if (cmd === 'sync') {
  try { const r = sync(paths.bankDir()); if (!has('--quiet')) process.stdout.write(r === 'failed' ? `sync: failed (details in ${paths.logsDir()}/hooks.log)\n` : `sync: ${r}\n`); if (r === 'failed') process.exitCode = 1; }
  catch (e) { process.stderr.write(`kb sync: ${(e as Error).message}\n`); process.exitCode = 1; }
}
else if (cmd === 'cleanup') {
  const actions = planCleanup(home); const apply = has('--apply');
  if (!actions.length) process.stdout.write('nothing to clean up\n');
  for (const a of actions) {
    const label = a.kind === 'flag' ? 'FLAG' : apply ? 'DONE' : 'PLAN';
    if (apply && a.kind !== 'flag') a.apply();
    process.stdout.write(`${label}  ${a.kind.padEnd(14)} ${a.target}  — ${a.reason}\n`);
    if (a.kind === 'disable-plugin') process.stdout.write(`      to uninstall as well: claude plugin uninstall ${a.target}\n`);
  }
  if (!apply && actions.some((a) => a.kind !== 'flag')) process.stdout.write('\nre-run with --apply to perform the PLAN lines (each edited file is backed up as <file>.bak-<timestamp>)\n');
} else if (cmd === 'setup') {
  const device = value('--device');
  if (has('--device') && !device) { process.stderr.write('--device needs a name\n'); process.exitCode = 2; }
  else setup(home, { device, appendClaudeMd: has('--append-claude-md') });
} else if (cmd === 'init') {
  const bank = value('--bank'), clone = value('--clone');
  if ((has('--bank') && !bank) || (has('--clone') && !clone)) { process.stderr.write('--bank and --clone need a value\n'); process.exitCode = 2; }
  else try { initBank({ bank, clone }); } catch (e) { process.stderr.write(`kb init: ${(e as Error).message}\n`); process.exitCode = 1; }
} else if (cmd === 'project' && args[0] === 'init') {
  const domain = value('--domain'), id = value('--id');
  if (!domain || (has('--id') && !id)) { process.stderr.write('usage: kb project init --domain <d> [--id <id>]\n'); process.exitCode = 2; }
  else process.stdout.write(JSON.stringify(projectInit(process.cwd(), { domain, id }), null, 2) + '\n');
} else if (cmd === 'export' || cmd === 'rebuild') {
  const db = openDb(), bank = paths.bankDir();
  try {
    if (cmd === 'export') process.stdout.write(`exported ${exportAll(db, bank)} notes to ${bank}\n`);
    else { const r = rebuild(db, bank); process.stdout.write(`rebuilt index from ${bank}: ${r.imported} notes imported\n`); }
  } catch (e) { process.stderr.write(`kb ${cmd}: ${(e as Error).message}\n`); process.exitCode = 1; } finally { db.sql.close(); }
} else if (cmd === 'concepts' && ['review', 'accept', 'reject', 'split'].includes(args[0]) && (args[0] === 'review' || args[1])) {
  const db = openDb(), bank = paths.bankDir(), [sub, arg] = args;
  try {
    if (sub === 'review') { const q = pendingQuestions(db, Number.MAX_SAFE_INTEGER); process.stdout.write(q.length ? q.join('\n') + '\n' : 'no pending concept merges\n'); }
    else if (sub === 'accept') { acceptMerge(db, bank, arg); process.stdout.write(`accepted ${arg}\n`); }
    else if (sub === 'reject') { rejectMerge(db, arg); process.stdout.write(`rejected ${arg}\n`); }
    else process.stdout.write(`split "${arg}" into ${splitAlias(db, bank, arg)}\n`);
  } catch (e) { process.stderr.write(`kb concepts ${sub}: ${(e as Error).message}\n`); process.exitCode = 1; } finally { db.sql.close(); }
} else if ((cmd === 'transfer' && args[0] && ['confirm', 'refute'].includes(args[1])) || (cmd === 'retract' && args[0]) || (cmd === 'set' && args.length >= 3)) {
  const db = openDb(), bank = paths.bankDir(), [id, a, b] = args;
  try {
    if (cmd === 'transfer') { const state = a === 'confirm' ? 'confirmed' : 'refuted'; const next = setTransfer(db, bank, id, state); process.stdout.write(`transfer ${id} ${state}; its id is now ${next}\n`); }
    else if (cmd === 'retract') { retractNote(db, bank, id); process.stdout.write(`retracted ${id}\n`); }
    else { setAttr(db, bank, id, a, b); process.stdout.write(`set ${a}=${b} on ${id}\n`); }
  } catch (e) { process.stderr.write(`kb ${cmd}: ${(e as Error).message}\n`); process.exitCode = 1; } finally { db.sql.close(); }
} else if (cmd === 'import' && ['serena', 'claude-memory', 'all'].includes(args[0])) {
  const root = value('--root');
  if (has('--root') && !root) { process.stderr.write('--root needs a directory\n'); process.exitCode = 2; }
  else {
    const db = openDb(), bank = paths.bankDir(), roots = [root ?? path.join(home, 'projects')]; // Ruling R6: default root ~/projects
    const line = (what: string, r: { files: number; created: number; unchanged: number }) => process.stdout.write(`${what}: ${r.files} files, ${r.created} created, ${r.unchanged} unchanged\n`);
    try {
      if (args[0] !== 'claude-memory') line('serena', importSerena(db, bank, roots));
      if (args[0] !== 'serena') line('claude-memory', importClaudeMemory(db, bank));
    } catch (e) { process.stderr.write(`kb import: ${(e as Error).message}\n`); process.exitCode = 1; } finally { db.sql.close(); }
  }
} else if (cmd === 'write' && args[0]) {
  // Bulk import: a JSON file {defaults?: {domain, project}, records: [{key?, ...WriteRecord}]}; a rel dst of "@key" points at a record written earlier in the file.
  const db = openDb(), bank = paths.bankDir();
  try {
    const spec = JSON.parse(readFileSync(args[0] === '-' ? 0 : args[0], 'utf8'));
    const defaults = (spec.defaults ?? {}) as { domain?: string; project?: string }, records = (spec.records ?? spec) as (WriteRecord & { key?: string })[];
    const ids = new Map<string, string>(), now = new Date().toISOString(); let written = 0, failed = 0;
    for (const { key, ...r } of records) {
      try {
        const rels = (r.rels ?? []).map((l) => ({ ...l, dst: l.dst.startsWith('@') ? (ids.get(l.dst.slice(1)) ?? (() => { throw new Error(`unknown key ${l.dst}`); })()) : l.dst }));
        const res = kbWrite(db, bank, { domain: defaults.domain, project: defaults.project, ...r, rels }, now);
        if (key) ids.set(key, res.id); written++;
        process.stdout.write(`${res.created ? 'created' : 'updated'}  ${res.id}  ${r.kind}  ${r.title}${res.transfers.length ? `  (${res.transfers.length} transfer${res.transfers.length === 1 ? '' : 's'} proposed)` : ''}\n`);
      } catch (e) { failed++; process.stdout.write(`error    ${r.kind}  ${r.title}: ${(e as Error).message}\n`); }
    }
    process.stdout.write(`${written} written, ${failed} failed\n`); if (failed) process.exitCode = 1;
  } catch (e) { process.stderr.write(`kb write: ${(e as Error).message}\n`); process.exitCode = 1; } finally { db.sql.close(); }
} else if (cmd === 'map') {
  const db = openDb();
  try {
    const file = generateMap(db); process.stdout.write(`${file}\n`);
    if (has('--open')) { const [bin, pre] = process.platform === 'darwin' ? ['open', []] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '']] : ['xdg-open', []]; spawn(bin, [...pre, file], { detached: true, stdio: 'ignore' }).unref(); }
  } catch (e) { process.stderr.write(`kb map: ${(e as Error).message}\n`); process.exitCode = 1; } finally { db.sql.close(); }
} else if (cmd === 'compare' && args[0]) {
  const db = openDb(), name = args.join(' ');
  try { const rows = compareConcept(db, resolveConceptRef(db, name)); process.stdout.write(rows.length ? rows.map((r) => compareLine(r)).join('\n') + '\n' : `no findings about ${name}\n`); }
  catch (e) { process.stderr.write(`kb compare: ${(e as Error).message}\n`); process.exitCode = 1; } finally { db.sql.close(); }
} else { process.stdout.write(usage); if (cmd && cmd !== 'help' && cmd !== '--help') process.exitCode = 2; }
