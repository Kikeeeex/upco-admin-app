import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPermission, parsePermissions } from '../lib/permissions.ts';
import { retentionFilename, retentionDisposition } from '../lib/tax/retentionFilename.ts';

test('master has all actions and operator receives only explicit permissions', () => {
  assert.equal(hasPermission({ role: 'master', permissions: [] }, 'documents.delete'), true);
  const operator = { role: 'operator', permissions: parsePermissions('["catalogs.manage","not-real"]') };
  assert.equal(hasPermission(operator, 'catalogs.manage'), true);
  assert.equal(hasPermission(operator, 'documents.delete'), false);
  assert.equal(hasPermission(operator, 'exports.run'), false);
});

test('retention filenames omit certificates and remove unsafe filesystem characters', () => {
  const filename = retentionFilename('Compañía: Norte/Sur, C.A.', 'F/63:1', 'combined');
  assert.equal(filename, 'Compañía Norte Sur, C.A - Fact. Nro. F 63 1 - IVA e ISLR retenidos.pdf');
  const header = retentionDisposition('Compañía Norte', '63', 'islr');
  assert.match(header, /filename\*=UTF-8''/);
  assert.match(decodeURIComponent(header), /Compañía Norte - Fact\. Nro\. 63 - ISLR retenido\.pdf/);
  assert.doesNotMatch(filename, /202611|2294/);
});
