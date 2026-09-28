import { Socket } from 'node:net';
import type { Readable } from 'node:stream';

export type ScanResult = { verdict: 'CLEAN' } | { verdict: 'INFECTED'; signature: string };

/** Scans a file for malware (SRS DOC-003, adapter `MalwareScanner`). */
export interface MalwareScanner {
  scan(file: Readable): Promise<ScanResult>;
}

/**
 * clamd over TCP with the INSTREAM command: the file is sent in length-prefixed chunks and never
 * written to disk. Replies are "stream: OK" or "stream: <signature> FOUND"; anything else (size
 * limit, clamd error) rejects, so the scan is retried or the document is marked as a scan error.
 */
export function clamdScanner(options: {
  host: string;
  port: number;
  timeoutMs?: number;
}): MalwareScanner {
  return {
    scan: (file) =>
      new Promise<ScanResult>((resolve, reject) => {
        const socket = new Socket();
        let reply = '';
        let settled = false;
        const finish = (err: Error | null, result?: ScanResult) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          file.destroy();
          if (err) reject(err);
          else resolve(result!);
        };
        socket.setTimeout(options.timeoutMs ?? 60_000, () =>
          finish(new Error('clamd did not answer in time')),
        );
        socket.on('error', (err) => finish(err));
        socket.on('data', (chunk) => (reply += chunk.toString('utf8')));
        socket.on('end', () => {
          const text = reply.replace(/\0/g, '').trim();
          const found = /^stream: (.+) FOUND$/.exec(text);
          if (text === 'stream: OK') finish(null, { verdict: 'CLEAN' });
          else if (found) finish(null, { verdict: 'INFECTED', signature: found[1]! });
          else finish(new Error(`clamd: ${text || 'no reply'}`));
        });
        socket.connect(options.port, options.host, () => {
          socket.write('zINSTREAM\0');
          file.on('data', (data: Buffer) => {
            const length = Buffer.alloc(4);
            length.writeUInt32BE(data.length);
            if (!socket.write(Buffer.concat([length, data]))) {
              file.pause();
              socket.once('drain', () => file.resume());
            }
          });
          file.on('end', () => socket.write(Buffer.alloc(4))); // zero length ends the stream
          file.on('error', (err) => finish(err));
        });
      }),
  };
}
