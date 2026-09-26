import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { print } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLocale } from '../../i18n';
import { gql } from '../../lib/api';
import type * as ApiModule from '../../lib/api';
import { renderScreen } from '../../test/render';
import { UserPage } from './UserPage';
import { UsersPage } from './UsersPage';

vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  gql: vi.fn(),
}));

const reference = {
  roles: [
    {
      id: 'r-store',
      code: 'STORE_USER',
      name: 'Store user',
      description: null,
      isSystem: true,
      permissions: [],
      userCount: 3,
    },
    {
      id: 'r-super',
      code: 'SUPER_ADMIN',
      name: 'Super administrator',
      description: null,
      isSystem: true,
      permissions: [],
      userCount: 1,
    },
  ],
  permissionCatalogue: ['indent:create'],
  locations: [
    {
      id: 'l1',
      code: 'BMC-01',
      name: 'Etawah BMC',
      nameHi: null,
      type: 'BMC',
      sapPlantCode: null,
      address: null,
      excludedFromCrossView: false,
      active: true,
    },
  ],
  departments: [{ id: 'd1', code: 'DAIRY', name: 'Dairy' }],
  designations: [],
};

/** Answers each GraphQL document by its operation name. */
function serve(answers: Record<string, unknown>) {
  vi.mocked(gql).mockImplementation((document: unknown, variables?: unknown) => {
    const name = /(?:query|mutation) (\w+)/.exec(print(document as never))?.[1] ?? '';
    const answer = answers[name];
    if (answer === undefined) throw new Error(`unexpected operation ${name}`);
    const value: unknown =
      typeof answer === 'function' ? (answer as (v: unknown) => unknown)(variables) : answer;
    return Promise.resolve(value);
  });
}

beforeEach(() => {
  applyLocale('en');
  vi.mocked(gql).mockReset();
});

describe('UsersPage', () => {
  it('lists users with their roles and status', async () => {
    serve({
      AdminReferenceData: reference,
      AdminUsers: {
        users: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
          edges: [
            {
              node: {
                id: 'u1',
                email: 'ramesh@shwetdhara.in',
                displayName: 'Ramesh Kumar',
                employeeCode: 'E042',
                status: 'LOCKED',
                lastLoginAt: null,
                primaryLocation: { id: 'l1', name: 'Etawah BMC' },
                roles: [{ role: { id: 'r-store', code: 'STORE_USER', name: 'Store user' } }],
              },
            },
          ],
        },
      },
    });
    await renderScreen(() => <UsersPage />);
    const row = (await screen.findByRole('link', { name: 'Ramesh Kumar' })).closest('tr')!;
    expect(within(row).getByText('Store user')).toBeInTheDocument();
    expect(within(row).getByText('Locked')).toBeInTheDocument();
    expect(within(row).getByText('Never')).toBeInTheDocument();
    expect(screen.getByText('1 users')).toBeInTheDocument();
  });
});

describe('creating a user', () => {
  async function fillProfile() {
    await userEvent.type(await screen.findByLabelText('E-mail (required)'), 'ramesh@shwetdhara.in');
    await userEvent.type(screen.getByLabelText(/^Full name/), 'Ramesh Kumar');
    await userEvent.selectOptions(screen.getByLabelText(/^Primary location/), 'l1');
  }

  it('sends the profile and roles, and shows server problems on their fields', async () => {
    const create = vi.fn(() => ({
      createUser: {
        user: null,
        userErrors: [
          {
            code: 'CONFLICT',
            message: 'validation.emailTaken',
            field: ['input', 'email'],
            details: null,
          },
          {
            code: 'FORBIDDEN',
            message: 'validation.beyondYourAccess',
            field: ['input', 'roles', '0', 'roleId'],
            details: null,
          },
        ],
      },
    }));
    serve({ AdminReferenceData: reference, AdminCreateUser: create });
    await renderScreen(() => <UserPage />);
    await fillProfile();
    await userEvent.click(screen.getByRole('button', { name: 'Add role' }));
    await userEvent.selectOptions(screen.getByLabelText('Role (required)'), 'r-super');
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith({
      input: expect.objectContaining({
        email: 'ramesh@shwetdhara.in',
        displayName: 'Ramesh Kumar',
        primaryLocationId: 'l1',
        roles: [{ roleId: 'r-super', scopeLocationIds: [], scopeDepartmentIds: [] }],
        sendInvite: true,
      }),
    });
    expect(
      await screen.findByText('Another user already has this e-mail address.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('You can only give access that you have yourself.'),
    ).toBeInTheDocument();
  });

  it('checks required fields before sending anything', async () => {
    serve({ AdminReferenceData: reference });
    await renderScreen(() => <UserPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Create user' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(3);
  });
});

describe('editing a user', () => {
  it('asks before deactivating, then deactivates', async () => {
    const update = vi.fn(() => ({
      updateUser: { user: { id: 'u1', version: 3, status: 'DISABLED' }, userErrors: [] },
    }));
    serve({
      AdminReferenceData: reference,
      AdminUpdateUser: update,
      AdminUser: {
        user: {
          id: 'u1',
          email: 'ramesh@shwetdhara.in',
          displayName: 'Ramesh Kumar',
          mobile: null,
          employeeCode: 'E042',
          status: 'ACTIVE',
          version: 2,
          preferredLocale: 'EN',
          deliveryPointCode: null,
          lastLoginAt: null,
          primaryLocation: { id: 'l1', name: 'Etawah BMC', code: 'BMC-01' },
          locations: [{ id: 'l1', name: 'Etawah BMC', code: 'BMC-01' }],
          department: null,
          designation: null,
          reportsTo: null,
          roles: [],
        },
      },
    });
    await renderScreen(() => <UserPage userId="u1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate Ramesh Kumar?' });
    expect(update).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        input: { id: 'u1', expectedVersion: 2, status: 'DISABLED' },
      }),
    );
  });
});
