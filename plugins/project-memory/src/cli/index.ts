import os from 'node:os';
import { doctor } from './doctor.js';
import { planCleanup } from './cleanup.js';
import { setup } from './setup.js';
import { initBank, projectInit } from './init.js';
import { paths } from '../lib/paths.js';
import { openDb } from '../kb/db.js';
import { exportAll, rebuild } from '../kb/export.js';
import { pendingQuestions, acceptMerge, rejectMerge, splitAlias } from '../kb/concepts.js';
import { setTransfer, retractNote, setAttr } from '../kb/write.js';
const [cmd, ...args] = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const value = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const home = os.homedir();
const usage = 'usage: kb init [--bank <dir>] [--clone <url>] | kb project init --domain <d> [--id <id>] | kb doctor [--baseline] [--live] | kb cleanup [--apply] | kb setup [--device <name>] [--append-claude-md] | kb export | kb rebuild | kb concepts review|accept <id>|reject <id>|split <name> | kb transfer <id> confirm|refute | kb retract <id> | kb set <id> <attr> <value>\n';
if (cmd === 'doctor') process.exitCode = doctor(home, { baseline: has('--baseline'), live: has('--live') });
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
    if (cmd === 'transfer') { const state = a === 'confirm' ? 'confirmed' : 'refuted'; setTransfer(db, bank, id, state); process.stdout.write(`transfer ${id} ${state}\n`); }
    else if (cmd === 'retract') { retractNote(db, bank, id); process.stdout.write(`retracted ${id}\n`); }
    else { setAttr(db, bank, id, a, b); process.stdout.write(`set ${a}=${b} on ${id}\n`); }
  } catch (e) { process.stderr.write(`kb ${cmd}: ${(e as Error).message}\n`); process.exitCode = 1; } finally { db.sql.close(); }
} else { process.stdout.write(usage); if (cmd && cmd !== 'help' && cmd !== '--help') process.exitCode = 2; }
