import os from 'node:os';
import { doctor } from './doctor.js';
import { planCleanup } from './cleanup.js';
import { setup } from './setup.js';
const [cmd, ...args] = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const value = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const home = os.homedir();
const usage = 'usage: kb doctor [--baseline] [--live] | kb cleanup [--apply] | kb setup [--device <name>] [--append-claude-md]\n';
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
} else { process.stdout.write(usage); if (cmd && cmd !== 'help' && cmd !== '--help') process.exitCode = 2; }
