import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { print } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLocale } from '../../i18n';
import { gql } from '../../lib/api';
import type * as ApiModule from '../../lib/api';
import { renderScreen } from '../../test/render';
import { MppsPage } from './MppsPage';
import { ProductPage } from './ProductPage';
import { ProductsPage } from './ProductsPage';
import { UnitsPage } from './UnitsPage';
import { VendorPage } from './VendorPage';

vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  gql: vi.fn(),
}));

const reference = {
  uoms: [
    { id: 'u-kg', code: 'KG', name: 'Kilogram', nameHi: null, decimalsAllowed: 3 },
    { id: 'u-bag', code: 'BAG_50KG', name: '50 kg bag', nameHi: null, decimalsAllowed: 0 },
  ],
  uomConversions: [
    {
      id: 'cv1',
      factor: '50',
      from: { id: 'u-bag', code: 'BAG_50KG' },
      to: { id: 'u-kg', code: 'KG' },
    },
  ],
  productCategories: [
    {
      id: 'c1',
      code: 'CONSUMABLE',
      name: 'Consumable',
      requiresInspection: false,
      parent: null,
      owner: null,
    },
  ],
  externalSystems: [
    { id: 's1', code: 'NDDB', name: 'NDDB', displayPriority: 1 },
    { id: 's2', code: 'SAP', name: 'SAP', displayPriority: 2 },
  ],
  locations: [
    { id: 'l1', code: 'BMC-01', name: 'Etawah BMC', type: 'BMC', active: true },
    { id: 'l2', code: 'HO', name: 'Head office', type: 'HEAD_OFFICE', active: true },
  ],
};

const me = (permissions: string[]) => ({
  me: {
    id: 'me',
    displayName: 'Admin',
    email: 'admin@shwetdhara.local',
    employeeCode: null,
    homeWorkspace: 'ADMIN',
    permissions,
    primaryLocation: null,
  },
});

const ALL = [
  'product:read',
  'product:create',
  'product:update',
  'product:map_external',
  'vendor:read',
  'vendor:create',
  'vendor:update',
  'vendor:map_products',
  'mpp:read',
  'mpp:manage',
  'admin:master_manage',
];

const noErrors = { userErrors: [] };

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

describe('ProductsPage', () => {
  it('lists products by display name and hides "New product" without product:create', async () => {
    serve({
      Me: me(['product:read']),
      CatalogReference: reference,
      MasterProducts: {
        products: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
          edges: [
            {
              node: {
                id: 'p1',
                code: 'CF-001',
                name: 'Cattle feed',
                displayName: 'Pashu Aahar',
                sizeLabel: '50 kg',
                isService: false,
                status: 'ACTIVE',
                baseUom: { id: 'u-bag', code: 'BAG_50KG' },
                category: { id: 'c1', name: 'Consumable' },
                standardPrice: { amount: '1250.00' },
              },
            },
          ],
        },
      },
    });
    await renderScreen(() => <ProductsPage />);
    const row = (await screen.findByRole('link', { name: 'Pashu Aahar' })).closest('tr')!;
    expect(within(row).getByText('Cattle feed · 50 kg')).toBeInTheDocument();
    expect(within(row).getByText('₹1,250.00')).toBeInTheDocument();
    expect(screen.getByText('1 products')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New product' })).not.toBeInTheDocument();
  });
});

describe('ProductPage', () => {
  async function fillBasics() {
    await userEvent.type(await screen.findByLabelText('Code (required)'), 'cf-001');
    await userEvent.type(screen.getByLabelText('Name (required)'), 'Cattle feed');
    await userEvent.selectOptions(screen.getByLabelText(/^Base unit/), 'u-bag');
  }

  it('sends external codes and shows a code taken elsewhere', async () => {
    const save = vi.fn(() => ({
      saveProduct: {
        product: null,
        userErrors: [
          {
            code: 'CONFLICT',
            message: 'validation.externalCodeTaken',
            // The database reports a taken code on the whole list, not on a row.
            field: ['input', 'externalCodes'],
            details: null,
          },
        ],
      },
    }));
    serve({ Me: me(ALL), CatalogReference: reference, MasterSaveProduct: save });
    await renderScreen(() => <ProductPage />);
    await fillBasics();
    await userEvent.type(screen.getByLabelText('Standard price'), '1250');
    await userEvent.click(screen.getByRole('button', { name: 'Add a code' }));
    await userEvent.type(screen.getByLabelText(/^Code$/), 'N-77');
    await userEvent.type(screen.getByLabelText(/^Name in that system/), 'Pashu Aahar');
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith({
      input: expect.objectContaining({
        code: 'CF-001',
        baseUomId: 'u-bag',
        standardPrice: '1250',
        reorderLevel: null,
        ownerUserId: null,
        externalCodes: [{ system: 'NDDB', code: 'N-77', name: 'Pashu Aahar', isPrimary: true }],
      }),
    });
    expect(
      await screen.findByText('Another product already has this code in that system.'),
    ).toBeInTheDocument();
  });

  it('leaves external codes alone without product:map_external', async () => {
    const save = vi.fn(() => ({
      saveProduct: { product: { id: 'p9', version: 1 }, ...noErrors },
    }));
    serve({
      Me: me(['product:read', 'product:create', 'product:update']),
      CatalogReference: reference,
      MasterSaveProduct: save,
    });
    await renderScreen(() => <ProductPage />);
    await fillBasics();
    expect(screen.queryByRole('button', { name: 'Add a code' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith({ input: expect.objectContaining({ externalCodes: null }) });
    expect(await screen.findByTestId('navigated')).toHaveTextContent('/masters/products/p9');
  });

  it('refuses a stocked service before sending', async () => {
    serve({ Me: me(ALL), CatalogReference: reference });
    await renderScreen(() => <ProductPage />);
    await fillBasics();
    await userEvent.click(screen.getByLabelText(/^Service/));
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));
    expect(await screen.findByText('A service cannot be kept in stock.')).toBeInTheDocument();
    expect(gql).not.toHaveBeenCalledWith(expect.anything(), {
      input: expect.anything(),
    });
  });
});

describe('VendorPage', () => {
  it('needs an e-mail or phone for each contact, then sends contacts with their purposes', async () => {
    const save = vi.fn(() => ({
      saveVendor: { vendor: { id: 'v1', version: 1 }, ...noErrors },
    }));
    serve({ Me: me(ALL), MasterSaveVendor: save });
    await renderScreen(() => <VendorPage />);
    await userEvent.type(await screen.findByLabelText('Name (required)'), 'Anand Feeds');
    await userEvent.click(screen.getByRole('button', { name: 'Create vendor' }));
    expect(
      await screen.findByText('Give an e-mail address or a phone number.'),
    ).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('E-mail'), 'orders@anandfeeds.in');
    await userEvent.click(screen.getByLabelText('Dispatch'));
    await userEvent.click(screen.getByRole('button', { name: 'Create vendor' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith({
      input: expect.objectContaining({
        name: 'Anand Feeds',
        contacts: [
          expect.objectContaining({ email: 'orders@anandfeeds.in', purposes: ['PO', 'DISPATCH'] }),
        ],
      }),
    });
  });

  it('adds a product to the vendor and saves the list', async () => {
    const set = vi.fn(() => ({ setVendorProducts: { vendor: { id: 'v1' }, ...noErrors } }));
    serve({
      Me: me(ALL),
      MasterVendor: {
        vendor: {
          id: 'v1',
          version: 3,
          code: 'V0001',
          name: 'Anand Feeds',
          legalName: null,
          gstin: null,
          pan: null,
          sapVendorCode: null,
          paymentTermsDays: 30,
          address: null,
          status: 'ACTIVE',
          contacts: [
            { id: 'k1', name: null, email: 'orders@anandfeeds.in', phone: null, purposes: ['PO'] },
          ],
          products: [],
        },
      },
      MasterProducts: {
        products: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null },
          edges: [
            {
              node: {
                id: 'p1',
                code: 'CF-001',
                name: 'Cattle feed',
                displayName: 'Pashu Aahar',
                sizeLabel: null,
                isService: false,
                status: 'ACTIVE',
                baseUom: { id: 'u-bag', code: 'BAG_50KG' },
                category: null,
                standardPrice: null,
              },
            },
          ],
        },
      },
      MasterSetVendorProducts: set,
    });
    await renderScreen(() => <VendorPage vendorId="v1" />);
    await userEvent.type(await screen.findByLabelText('Add a product'), 'cattle');
    await userEvent.click(await screen.findByRole('button', { name: /Pashu Aahar/ }));
    await userEvent.click(screen.getByLabelText('Primary: Pashu Aahar'));
    await userEvent.click(screen.getByRole('button', { name: 'Save products' }));
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith({
        input: {
          vendorId: 'v1',
          items: [{ productId: 'p1', priority: 1, isPrimary: true, leadTimeDays: null }],
        },
      }),
    );
  });
});

describe('UnitsPage', () => {
  it('shows conversions and refuses one between the same unit', async () => {
    serve({ Me: me(ALL), CatalogReference: reference });
    await renderScreen(() => <UnitsPage />);
    expect(await screen.findByText('1 BAG_50KG = 50 KG')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New conversion' }));
    const dialog = await screen.findByRole('dialog', { name: 'New conversion' });
    await userEvent.selectOptions(within(dialog).getByLabelText(/^One/), 'u-kg');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Unit/), 'u-kg');
    await userEvent.type(within(dialog).getByLabelText(/^Equals/), '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Choose two different units.')).toBeInTheDocument();
  });
});

describe('MppsPage', () => {
  it('offers only BMCs and MCCs and saves a new MPP', async () => {
    const save = vi.fn(() => ({ saveMpp: { mpp: { id: 'm1' }, ...noErrors } }));
    serve({
      Me: me(ALL),
      CatalogReference: reference,
      MasterMpps: {
        mpps: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, edges: [] },
      },
      MasterSaveMpp: save,
    });
    await renderScreen(() => <MppsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'New MPP' }));
    const dialog = await screen.findByRole('dialog', { name: 'New MPP' });
    const centre = within(dialog).getByLabelText(/^BMC \/ MCC/);
    expect(within(centre).queryByText(/Head office/)).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/^MPP transaction code/), 'mpp-101');
    await userEvent.type(within(dialog).getByLabelText('Name (required)'), 'Bakewar');
    await userEvent.selectOptions(centre, 'l1');
    await userEvent.selectOptions(within(dialog).getByLabelText('Cycle band'), 'DAYS_11_20');
    await userEvent.type(within(dialog).getByLabelText(/^Sahayak mobile/), '+91 98765 43210');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        input: expect.objectContaining({
          code: 'MPP-101',
          bmcLocationId: 'l1',
          cycleBand: 'DAYS_11_20',
          sahayakMobile: '+919876543210',
        }),
      }),
    );
  });
});
