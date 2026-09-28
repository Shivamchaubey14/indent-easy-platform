import { createServer, type Server } from 'node:net';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { clamdScanner } from './clamav.js';

let server: Server | undefined;

/**
 * A stand-in for clamd: reads the INSTREAM command and its length-prefixed chunks, then answers
 * with whatever `reply` returns for the reassembled file.
 */
async function fakeClamd(reply: (file: Buffer) => string): Promise<number> {
  const fake = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      const command = Buffer.from('zINSTREAM\0');
      if (buffer.length < command.length) return;
      let offset = command.length;
      const parts: Buffer[] = [];
      while (buffer.length >= offset + 4) {
        const size = buffer.readUInt32BE(offset);
        if (size === 0) {
          socket.end(`${reply(Buffer.concat(parts))}\0`);
          return;
        }
        if (buffer.length < offset + 4 + size) return;
        parts.push(buffer.subarray(offset + 4, offset + 4 + size));
        offset += 4 + size;
      }
    });
  });
  server = fake;
  await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
  const address = fake.address();
  return typeof address === 'object' && address ? address.port : 0;
}

afterEach(() => server?.close());

describe('clamd scanner', () => {
  it('sends the whole file in chunks and reads a clean verdict', async () => {
    let received = 0;
    const port = await fakeClamd((file) => ((received = file.length), 'stream: OK'));
    const file = Readable.from([Buffer.alloc(70_000, 1), Buffer.alloc(70_000, 2)]);
    await expect(clamdScanner({ host: '127.0.0.1', port }).scan(file)).resolves.toEqual({
      verdict: 'CLEAN',
    });
    expect(received).toBe(140_000);
  });

  it('reports the signature of an infected file', async () => {
    const port = await fakeClamd(() => 'stream: Win.Test.EICAR_HDB-1 FOUND');
    await expect(
      clamdScanner({ host: '127.0.0.1', port }).scan(Readable.from([Buffer.from('x')])),
    ).resolves.toEqual({ verdict: 'INFECTED', signature: 'Win.Test.EICAR_HDB-1' });
  });

  it('rejects on anything else, so the check is retried instead of trusting the file', async () => {
    const port = await fakeClamd(() => 'INSTREAM size limit exceeded. ERROR');
    await expect(
      clamdScanner({ host: '127.0.0.1', port }).scan(Readable.from([Buffer.from('x')])),
    ).rejects.toThrow('size limit');
    await expect(
      clamdScanner({ host: '127.0.0.1', port: 1 }).scan(Readable.from([Buffer.from('x')])),
    ).rejects.toThrow();
  });
});
