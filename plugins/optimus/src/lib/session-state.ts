import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { paths } from './paths.js';
import { writeFileAtomic } from './atomic.js';
/** `briefed`: finding ids (and markers) already injected into this agent; `lastBrief`: the last recall brief, re-injected when the bank query throws (DESIGN §3.1). */
export type SessionState = { seenBlobs: string[]; lastSnapshotOffset: number; snapshots: { id: string; from: number; to: number; at: string }[]; briefed: string[]; startedAt: string; lastBrief?: string };
const empty = (): SessionState => ({ seenBlobs: [], lastSnapshotOffset: 0, snapshots: [], briefed: [], startedAt: new Date().toISOString() });
export function loadState(sessionId: string, agentId = 'main'): SessionState { try { return { ...empty(), ...JSON.parse(readFileSync(path.join(paths.sessionDir(sessionId, agentId), 'state.json'), 'utf8')) }; } catch { return empty(); } }
export function saveState(sessionId: string, s: SessionState, agentId = 'main'): void { writeFileAtomic(path.join(paths.sessionDir(sessionId, agentId), 'state.json'), JSON.stringify(s, null, 2) + '\n'); }
export function deleteSession(sessionId: string): void { rmSync(path.dirname(paths.sessionDir(sessionId)), { recursive: true, force: true }); }
