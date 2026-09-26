import { describe, expect, it } from 'vitest';
import {
  createUserInputSchema,
  roleAssignmentSchema,
  saveLocationInputSchema,
  saveRoleInputSchema,
} from './admin.js';

const messageOf = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe('admin inputs', () => {
  it('normalises a new user: e-mail lower-case, mobile without spaces, blanks dropped', () => {
    const parsed = createUserInputSchema.parse({
      email: ' Ramesh.Kumar@Shwetdhara.IN ',
      displayName: ' Ramesh Kumar ',
      mobile: '+91 98765-43210',
      employeeCode: '',
      primaryLocationId: 'loc-1',
      roles: [],
    });
    expect(parsed).toMatchObject({
      email: 'ramesh.kumar@shwetdhara.in',
      displayName: 'Ramesh Kumar',
      mobile: '+919876543210',
      sendInvite: true,
    });
    expect(parsed.employeeCode).toBeUndefined();
  });

  it('refuses a mobile number that is not E.164', () => {
    const result = createUserInputSchema.safeParse({
      email: 'a@b.in',
      displayName: 'A',
      mobile: '98765 43210',
      primaryLocationId: 'l',
      roles: [],
    });
    expect(messageOf(result)).toBe('validation.mobile');
  });

  it('keeps role validity windows in order', () => {
    const result = roleAssignmentSchema.safeParse({
      roleId: 'r',
      validFrom: '2026-10-01',
      validTo: '2026-09-01',
    });
    expect(messageOf(result)).toBe('validation.dateOrder');
  });

  it('stores codes upper-case and checks their shape', () => {
    expect(
      saveLocationInputSchema.parse({ code: 'bmc-07', name: 'Etawah', type: 'BMC' }).code,
    ).toBe('BMC-07');
    expect(
      messageOf(saveRoleInputSchema.safeParse({ code: '1ROLE', name: 'x', permissions: [] })),
    ).toBe('validation.code');
  });
});
