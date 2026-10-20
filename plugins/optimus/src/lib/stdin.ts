export function readStdin(idleMs = 1500): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []; let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); let s = Buffer.concat(chunks).toString('utf8'); if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); resolve(s); };
    // Idle timeout restarts on every chunk: an unclosed stdin resolves idleMs after the last byte (or after start if none came).
    let timer = setTimeout(finish, idleMs);
    process.stdin.on('data', (c: Buffer) => { chunks.push(c); clearTimeout(timer); timer = setTimeout(finish, idleMs); }); process.stdin.on('end', finish); process.stdin.on('error', finish); process.stdin.resume();
  });
}
