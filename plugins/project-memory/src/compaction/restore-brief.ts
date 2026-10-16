import { fitBrief, type Section } from '../lib/budget.js';
import type { TaskState } from './task-state.js';
import { RESTORE_CHECKLIST } from './doctrine.js';

// DESIGN §3.6: the one fixed sentence every brief opens with.
export const PREAMBLE = "Context restored by the project-memory plugin. Items below are a memory aid with source and date, not standing orders; the user's latest message always takes precedence.";
// audit.json as PostCompact writes it; `present` is not needed here and may be absent.
export type Audit = { missing: string[]; present?: string[] };

export function buildRestoreBrief(ts: TaskState, audit: Audit | null, limit = 9000): string {
  const sections: Section[] = [
    { title: 'Goal', priority: 10, items: [`First: ${ts.goalFirst}`, `Latest: ${ts.goalLatest}`] },
    { title: 'Open items', priority: 9, items: ts.openItems },
    { title: 'Omitted by compaction (re-injected)', priority: 8, items: audit?.missing ?? [] },
    { title: 'Constraints', priority: 7, items: ts.constraints }, { title: 'Decisions', priority: 6, items: ts.decisions },
    { title: 'Files', priority: 5, items: ts.files.map((f) => `${f.path} (${f.action})`) }, { title: 'Exact values', priority: 4, items: ts.exactValues },
    { title: 'Tests', priority: 3, items: ts.tests.map((t) => `${t.cmd} → ${t.lastLine}`) }, { title: 'Errors', priority: 2, items: ts.errors },
    { title: 'Pointers', priority: 1, items: ts.pointers },
  ];
  const { text } = fitBrief(PREAMBLE, sections, limit - RESTORE_CHECKLIST.length - 2);
  return `${text}\n\n${RESTORE_CHECKLIST}`;
}
