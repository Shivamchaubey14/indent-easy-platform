import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseValues, readDump, type LegacyRow } from './dump.js';

describe('mysqldump values', () => {
  it('reads strings with MySQL escapes, NULL and numbers', () => {
    const bs = String.fromCharCode(92); // backslash
    const text = `(1,'O${bs}'Neil ${bs}${bs} Sons',NULL,12.50),(2,'line${bs}nbreak','it''s',-3)`;
    expect(parseValues(text)).toEqual([
      [1, `O'Neil ${bs} Sons`, null, 12.5],
      [2, 'line\nbreak', "it's", -3],
    ]);
  });

  it('keeps integers beyond JavaScript precision as text', () => {
    expect(parseValues('(90071992547409930)')).toEqual([['90071992547409930']]);
  });
});

describe('reading a dump', () => {
  it('maps rows to columns and skips WhatsApp and Django tables', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ie-dump-'));
    const file = join(dir, 'dump.sql');
    writeFileSync(
      file,
      [
        'CREATE TABLE `main_app_vendor` (',
        '  `id` bigint NOT NULL AUTO_INCREMENT,',
        '  `name` varchar(255) NOT NULL,',
        '  `email` longtext,',
        '  PRIMARY KEY (`id`)',
        ') ENGINE=InnoDB;',
        "INSERT INTO `main_app_vendor` VALUES (1,'Anand Feeds','a@x.in, b@x.in'),(2,'Gyan','NULL');",
        "INSERT INTO `main_app_whatsapplog` VALUES (1,'+919876543210','hello');",
        "INSERT INTO `django_session` VALUES ('k','data','2026-01-01');",
        "INSERT INTO `main_app_employee` (`id`,`employee_code`,`employee_name`) VALUES (7,'SH117','Ram');",
      ].join('\n'),
    );
    const seen: Record<string, LegacyRow[]> = {};
    const result = await readDump(file, (table, rows) => {
      (seen[table] ??= []).push(...rows);
      return Promise.resolve();
    });
    expect(seen['main_app_vendor']).toEqual([
      { id: 1, name: 'Anand Feeds', email: 'a@x.in, b@x.in' },
      { id: 2, name: 'Gyan', email: 'NULL' },
    ]);
    expect(seen['main_app_employee']).toEqual([
      { id: 7, employee_code: 'SH117', employee_name: 'Ram' },
    ]);
    expect(Object.keys(seen)).not.toContain('main_app_whatsapplog');
    expect(result.skipped.sort()).toEqual(['django_session', 'main_app_whatsapplog']);
  });
});
